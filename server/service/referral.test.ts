import { diContainer } from "inversify.config";
import { UserError } from "server/base/errors";
import { REWARD_STATUS, REWARD_TYPE } from "server/repositories/referral";
import { TYPES } from "server/types";
import ReferralService, {
  REFEREE_CREDITS_REWARD_QUANTITY,
  REFERRER_CREDITS_REWARD_QUANTITY,
  USER_ERROR,
} from "./referral";

describe("ReferralService", () => {
  const referralService = diContainer.get<ReferralService>(
    TYPES.ReferralService
  );
  const refereeUserId = "TEST_REFEREE_USER_ID";
  const referralId = "TEST_REFERRAL_ID";
  const referrerUserId = "TEST_REFERRER_USER_ID";
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
        new UserError("Invalid referral id", USER_ERROR.INVALID_REFERRAL_ID)
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

  describe("registerReferral", () => {
    it("Fails if referral is duplicate", async () => {
      jest
        .spyOn(referralService.repo, "createWithoutSurrogateKey")
        .mockRejectedValueOnce({ code: "ConditionalCheckFailedException" });
      await expect(
        referralService.registerReferral(refereeUserId, referrerUserId)
      ).rejects.toThrow(
        new UserError(
          "This user's referral is already registerd",
          USER_ERROR.DUPLICATE_REFERRAL
        )
      );
    });

    it("Successfully registers otherwise", async () => {
      const referral = {
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
        .spyOn(referralService.cleverTapService, "registerEvent")
        .mockResolvedValueOnce();
      jest.spyOn(referralService.repo, "update").mockResolvedValueOnce({
        ...referral,
        reward: {
          referee: {
            ...referral.reward.referee,
            status: REWARD_STATUS.REWARDED,
          },
          referrer: {
            ...referral.reward.referrer,
            status: REWARD_STATUS.REWARDED,
          },
        },
      });

      expect(
        await referralService.registerReferral(refereeUserId, referrerUserId)
      ).toMatchObject({
        reward: {
          type: referral.reward.referee.type,
          quantity: referral.reward.referee.quantity,
        },
        updatedSubscription: updatedRefereeSubscription,
      });
    });
  });
});
