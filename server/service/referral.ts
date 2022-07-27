import { inject, injectable } from "inversify";
import { UserError } from "server/base/errors";
import { User } from "server/base/models/user";
import { JSONPatch, Repo } from "server/repositories/base";
import {
  ReferralEntity,
  REWARD_STATUS,
  REWARD_TYPE,
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

@injectable()
export default class ReferralService implements IService {
  @inject(TYPES.ReferralRepo) repo: Repo<ReferralEntity>;
  @inject(TYPES.UserService) userService: UserService;
  @inject(TYPES.SubscriptionService) subscriptionService: SubscriptionService;

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

  async registerReferral(
    refereeUserId: string,
    referrerUserId: string
  ): Promise<{
    reward: {
      type: REWARD_TYPE;
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

    // TODO: Send clevertap event to referrer
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
          type: REWARD_TYPE.CREDITS,
          quantity: REFEREE_CREDITS_REWARD_QUANTITY,
          status: REWARD_STATUS.INITIATED,
        },
        referrer: {
          type: REWARD_TYPE.CREDITS,
          quantity: REFERRER_CREDITS_REWARD_QUANTITY,
          status: REWARD_STATUS.INITIATED,
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
            type: REWARD_TYPE.CREDITS,
            quantity: REFEREE_CREDITS_REWARD_QUANTITY,
            status: REWARD_STATUS.REWARDED,
          },
          referrer: {
            type: REWARD_TYPE.CREDITS,
            quantity: REFERRER_CREDITS_REWARD_QUANTITY,
            status: REWARD_STATUS.REWARDED,
          },
        },
      },
    ];
  }
}
