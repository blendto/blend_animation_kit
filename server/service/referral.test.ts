import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { diContainer } from "inversify.config";
import { UserError } from "server/base/errors";
import { RewardStatus, RewardType } from "server/repositories/referral";
import { TYPES } from "server/types";
import ReferralService, {
  REFEREE_CREDITS_REWARD_QUANTITY,
  REFERRER_CREDITS_REWARD_QUANTITY,
  REFERRAL_USER_ERROR,
} from "./referral";

describe("ReferralService", () => {
  const referralService = diContainer.get<ReferralService>(
    TYPES.ReferralService
  );
  const refereeUserId = "1_TEST_REFEREE_USER_ID";
  const refereeUserId2 = "2_TEST_REFEREE_USER_ID";
  const referralId = "TEST_REFERRAL_ID";
  const referrerUserId = "TEST_REFERRER_USER_ID";
  const deviceId = "TEST_DEVICE_ID";
  const deviceId2 = "TEST_DEVICE_ID_2";
  const createdAt = Date.now();
  const updatedAt = createdAt;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getReferrerOrFail", () => {
    it("Fails if referral id is invalid", async () => {
      jest
        .spyOn(referralService.userService, "getWithReferralId")
        .mockResolvedValueOnce(null);
      await expect(
        referralService.getReferrerOrFail(referralId)
      ).rejects.toThrow(
        new UserError(
          "Invalid referral id",
          REFERRAL_USER_ERROR.INVALID_REFERRAL_ID
        )
      );
    });

    it("Returns the referrer's profile if referral id is valid", async () => {
      const user = {
        id: referrerUserId,
        referralId,
        socialHandles: {},
        createdAt,
        updatedAt,
        activitySummary: {
          posts: 0,
          shoutoutsReceived: 0,
        },
        favouriteRecipes: [],
      };
      jest
        .spyOn(referralService.userService, "getWithReferralId")
        .mockResolvedValueOnce(user);

      expect(await referralService.getReferrerOrFail(referralId)).toMatchObject(
        user
      );
    });
  });

  describe("register", () => {
    it("Fails if referral is duplicate", async () => {
      jest
        .spyOn(referralService.repo, "createWithoutSurrogateKey")
        .mockRejectedValueOnce(
          new ConditionalCheckFailedException({
            $metadata: {},
            message: "",
          })
        );
      await expect(
        referralService.register(refereeUserId, referrerUserId, deviceId)
      ).rejects.toThrow(
        new UserError(
          "This user's referral is already registerd",
          REFERRAL_USER_ERROR.DUPLICATE_REFERRAL
        )
      );
    });

    it("Successfully registers otherwise", async () => {
      const referral = {
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
        createdAt,
        updatedAt,
      };
      const updatedRefereeSubscription = {
        adhocCredits: 0,
        planCredits: 15,
        expiry: new Date(
          new Date(createdAt).setMonth(new Date(createdAt).getMonth() + 1)
        ).getDate(),
        updatedAt,
      };
      const updatedReferrerSubscription = {
        ...updatedRefereeSubscription,
        planCredits: 20,
      };

      jest
        .spyOn(referralService.repo, "createWithoutSurrogateKey")
        .mockResolvedValueOnce(referral);
      jest
        .spyOn(referralService.subscriptionService, "addCredits")
        .mockResolvedValueOnce(updatedReferrerSubscription)
        .mockResolvedValueOnce(updatedRefereeSubscription);
      jest
        .spyOn(referralService.repo, "update")
        .mockResolvedValueOnce({
          ...referral,
          reward: {
            referee: {
              ...referral.reward.referee,
              status: RewardStatus.INITIATED,
            },
            referrer: {
              ...referral.reward.referrer,
              status: RewardStatus.REWARDED,
            },
          },
        })
        .mockResolvedValueOnce({
          ...referral,
          reward: {
            referee: {
              ...referral.reward.referee,
              status: RewardStatus.REWARDED,
            },
            referrer: {
              ...referral.reward.referrer,
              status: RewardStatus.REWARDED,
            },
          },
        });

      expect(
        await referralService.register(refereeUserId, referrerUserId, deviceId)
      ).toMatchObject({
        reward: {
          type: referral.reward.referee.type,
          quantity: referral.reward.referee.quantity,
        },
        updatedSubscription: updatedRefereeSubscription,
      });
    });
  });

  describe("getSummary", () => {
    it("returns all referrals of a user and it's summary", async () => {
      jest.spyOn(referralService, "listReferrals").mockResolvedValueOnce([
        {
          referrerUserId,
          deviceId,
          createdAt: 1658988589733,
          reward: {
            referee: {
              type: RewardType.CREDITS,
              quantity: 5,
              status: RewardStatus.REWARDED,
            },
            referrer: {
              type: RewardType.CREDITS,
              quantity: 10,
              status: RewardStatus.REWARDED,
            },
          },
          updatedAt: 1658988592878,
          refereeUserId,
        },
        {
          referrerUserId,
          deviceId: deviceId2,
          createdAt: 1659003363774,
          reward: {
            referee: {
              type: RewardType.CREDITS,
              quantity: 5,
              status: RewardStatus.REWARDED,
            },
            referrer: {
              type: RewardType.CREDITS,
              quantity: 10,
              status: RewardStatus.REWARDED,
            },
          },
          updatedAt: 1659003366227,
          refereeUserId: refereeUserId2,
        },
      ]);

      expect(await referralService.getSummary(referrerUserId)).toMatchObject({
        referrals: [
          {
            refereeId: "1_TE",
            referredAt: 1658988589733,
            rewardGained: {
              type: RewardType.CREDITS,
              quantity: 10,
            },
          },
          {
            refereeId: "2_TE",
            referredAt: 1659003363774,
            rewardGained: {
              type: RewardType.CREDITS,
              quantity: 10,
            },
          },
        ],
        count: 2,
        rewardSummary: [
          {
            type: RewardType.CREDITS,
            quantity: 20,
          },
        ],
      });
    });
  });
});
