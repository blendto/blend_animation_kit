import { inject, injectable } from "inversify";
import { sum } from "lodash";
import { UserError } from "server/base/errors";
import { User } from "server/base/models/user";
import CleverTapService, {
  CleverTapEventName,
} from "server/external/clevertap";
import { JSONPatch, Repo } from "server/repositories/base";
import {
  ReferralEntity,
  RewardStatus,
  RewardType,
} from "server/repositories/referral";
import { TYPES } from "server/types";
import { IService } from ".";
import SubscriptionService, {
  CreditAdditionReason,
  SubscriptionEntity,
} from "./subscription";
import { UserService } from "./user";

export const REFEREE_CREDITS_REWARD_QUANTITY = 5;
export const REFERRER_CREDITS_REWARD_QUANTITY = 10;

export enum USER_ERROR {
  INVALID_REFERRAL_ID = "INVALID_REFERRAL_ID",
  DUPLICATE_REFERRAL = "DUPLICATE_REFERRAL",
}

export type ReferralDashboardItem = {
  refereeId: string;
  referredAt: number;
  rewardGained: { type: string; quantity: number };
};

@injectable()
export default class ReferralService implements IService {
  @inject(TYPES.ReferralRepo) repo: Repo<ReferralEntity>;
  @inject(TYPES.UserService) userService: UserService;
  @inject(TYPES.SubscriptionService) subscriptionService: SubscriptionService;
  @inject(TYPES.CleverTapService) cleverTapService: CleverTapService;

  async getReferrerOrFail(referralId: string): Promise<User> {
    const referrer = await this.userService.getWithReferralId(referralId);
    if (!referrer) {
      throw new UserError(
        "Invalid referral id",
        USER_ERROR.INVALID_REFERRAL_ID
      );
    }
    return referrer;
  }

  async register(
    refereeUserId: string,
    referrerUserId: string
  ): Promise<{
    reward: {
      type: RewardType;
      quantity: number;
    };
    updatedSubscription: SubscriptionEntity;
  }> {
    const referral = await this.createReferralEntity(
      this.generateReferralEntity(refereeUserId, referrerUserId)
    );

    await this.subscriptionService.addCredits(
      referrerUserId,
      referral.reward.referrer.quantity,
      CreditAdditionReason.REFERRER_REWARD
    );
    const updatedSubscription = await this.subscriptionService.addCredits(
      refereeUserId,
      referral.reward.referee.quantity,
      CreditAdditionReason.REFEREE_REWARD
    );

    await this.repo.update(
      { refereeUserId },
      this.generateSuccessfulRewardDelta()
    );

    await this.cleverTapService.registerEvent(
      referrerUserId,
      CleverTapEventName.SUCCESSFUL_REFERRAL,
      {
        rewardType: referral.reward.referrer.type,
        rewardQuantity: referral.reward.referrer.quantity,
      }
    );
    return {
      reward: {
        type: referral.reward.referee.type,
        quantity: referral.reward.referee.quantity,
      },
      updatedSubscription,
    };
  }

  private generateReferralEntity(
    refereeUserId: string,
    referrerUserId: string
  ): Partial<ReferralEntity> {
    return {
      refereeUserId,
      referrerUserId,
      reward: {
        referee: {
          type: RewardType.CREDITS,
          quantity: REFEREE_CREDITS_REWARD_QUANTITY,
          status: RewardStatus.INITIATED,
        },
        referrer: {
          type: RewardType.CREDITS,
          quantity: REFERRER_CREDITS_REWARD_QUANTITY,
          status: RewardStatus.INITIATED,
        },
      },
    };
  }

  private async createReferralEntity(
    partialEntity: Partial<ReferralEntity>
  ): Promise<ReferralEntity> {
    try {
      return await this.repo.createWithoutSurrogateKey(partialEntity);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err.code === "ConditionalCheckFailedException") {
        throw new UserError(
          "This user's referral is already registerd",
          USER_ERROR.DUPLICATE_REFERRAL
        );
      }
      throw err;
    }
  }

  private generateSuccessfulRewardDelta(): JSONPatch {
    return [
      {
        op: "replace",
        path: "/reward",
        value: {
          referee: {
            type: RewardType.CREDITS,
            quantity: REFEREE_CREDITS_REWARD_QUANTITY,
            status: RewardStatus.REWARDED,
          },
          referrer: {
            type: RewardType.CREDITS,
            quantity: REFERRER_CREDITS_REWARD_QUANTITY,
            status: RewardStatus.REWARDED,
          },
        },
      },
    ];
  }

  async getSummary(referrerUserId: string): Promise<{
    referrals: ReferralDashboardItem[];
    count: number;
    rewardSummary: { type: RewardType; quantity: number }[];
  }> {
    const referrals = this.generateReferralDashboardItems(
      await this.listReferrals(referrerUserId)
    );
    return {
      referrals,
      count: referrals.length,
      rewardSummary: [
        {
          type: RewardType.CREDITS,
          quantity: sum(referrals.map((r) => r.rewardGained.quantity)),
        },
      ],
    };
  }

  async listReferrals(referrerUserId: string): Promise<ReferralEntity[]> {
    return await this.repo.query({ referrerUserId });
  }

  generateReferralDashboardItems(
    referrals: ReferralEntity[]
  ): ReferralDashboardItem[] {
    return referrals.map((r) => ({
      // Don't show the full ids of other users
      refereeId: r.refereeUserId.slice(0, 4),
      referredAt: r.createdAt,
      rewardGained: {
        type: r.reward.referrer.type,
        quantity: r.reward.referrer.quantity,
      },
    }));
  }
}
