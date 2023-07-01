import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { inject, injectable } from "inversify";
import { sum } from "lodash";
import { UserError } from "server/base/errors";
import { User } from "server/base/models/user";
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
  NativeCreditsEntity,
} from "./subscription";
import { UserService } from "./user";

export const REFEREE_CREDITS_REWARD_QUANTITY = 10;
export const REFERRER_CREDITS_REWARD_QUANTITY = 10;

export enum REFERRAL_USER_ERROR {
  INVALID_REFERRAL_ID = "INVALID_REFERRAL_ID",
  DUPLICATE_REFERRAL = "DUPLICATE_REFERRAL",
  DUPLICATE_DEVICE_ID = "DUPLICATE_DEVICE_ID",
  SELF_REFERRAL = "SELF_REFERRAL",
  EXISTING_USER = "EXISTING_USER",
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

  async ensureDeviceIdIsOriginal(deviceId: string): Promise<void> {
    const referrals = await this.repo.query({ deviceId });
    if (referrals.length > 0) {
      throw new UserError(
        "Duplicate device id",
        REFERRAL_USER_ERROR.DUPLICATE_DEVICE_ID
      );
    }
  }

  async ensureRefereeIsNew(refereeId: string): Promise<void> {
    const referee = await this.userService.getOrCreate(refereeId);
    const oneDayInMS = 24 * 60 * 60 * 1000;
    if (new Date().getTime() - referee.createdAt >= oneDayInMS) {
      throw new UserError(
        "Referral rewards are applicable only for new users",
        REFERRAL_USER_ERROR.EXISTING_USER
      );
    }
  }

  async getReferrerOrFail(referralId: string): Promise<User> {
    const referrer = await this.userService.getWithReferralId(referralId);
    if (!referrer) {
      throw new UserError(
        "Invalid referral id",
        REFERRAL_USER_ERROR.INVALID_REFERRAL_ID
      );
    }
    return referrer;
  }

  async register(
    refereeUserId: string,
    referrerUserId: string,
    deviceId: string
  ): Promise<{
    referrerId: string;
    reward: {
      type: RewardType;
      quantity: number;
    };
  }> {
    const referral = await this.createReferralEntity(
      this.generateReferralEntity(refereeUserId, referrerUserId, deviceId)
    );

    await this.subscriptionService.addCredits(
      referrerUserId,
      referral.reward.referrer.quantity,
      CreditAdditionReason.REFERRER_REWARD
    );
    await this.repo.update(
      { refereeUserId },
      this.generateSuccessfulRewardDelta({ refereeRewarded: false })
    );
    await this.subscriptionService.addCredits(
      refereeUserId,
      referral.reward.referee.quantity,
      CreditAdditionReason.REFEREE_REWARD
    );
    await this.repo.update(
      { refereeUserId },
      this.generateSuccessfulRewardDelta({})
    );

    return {
      referrerId: referrerUserId,
      reward: {
        type: referral.reward.referee.type,
        quantity: referral.reward.referee.quantity,
      },
    };
  }

  private generateReferralEntity(
    refereeUserId: string,
    referrerUserId: string,
    deviceId: string
  ): Partial<ReferralEntity> {
    return {
      refereeUserId,
      referrerUserId,
      deviceId,
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
      if ((err as Error).name === ConditionalCheckFailedException.name) {
        throw new UserError(
          "This user's referral is already registerd",
          REFERRAL_USER_ERROR.DUPLICATE_REFERRAL
        );
      }
      throw err;
    }
  }

  private generateSuccessfulRewardDelta({
    referrerRewarded = true,
    refereeRewarded = true,
  }): JSONPatch {
    return [
      {
        op: "replace",
        path: "/reward",
        value: {
          referee: {
            type: RewardType.CREDITS,
            quantity: REFEREE_CREDITS_REWARD_QUANTITY,
            status: refereeRewarded
              ? RewardStatus.REWARDED
              : RewardStatus.INITIATED,
          },
          referrer: {
            type: RewardType.CREDITS,
            quantity: REFERRER_CREDITS_REWARD_QUANTITY,
            status: referrerRewarded
              ? RewardStatus.REWARDED
              : RewardStatus.INITIATED,
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
