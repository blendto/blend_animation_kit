import { diContainer } from "inversify.config";

import { TYPES } from "server/types";
import { User } from "server/base/models/user";
import { UpdateOperations } from "server/repositories";
import { UserUpdatePaths } from "server/repositories/user";
import { UserService } from "server/service/user";

describe("UserService", () => {
  const userService = diContainer.get<UserService>(TYPES.UserService);
  const id = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const stripeCustomerId = "cus_4QE4bx4C5BVSrC";
  const createdAt = 1646906641;
  const updatedAt = 1646906641;
  const userDoc: User = {
    id,
    stripeCustomerId,
    socialHandles: {},
    createdAt,
    updatedAt,
    activitySummary: {
      posts: 0,
      shoutoutsReceived: 0,
    },
    favouriteRecipes: [],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("update", () => {
    it("Supports updating stripe customer id", async () => {
      const modelUpdateMock = jest
        .spyOn(userService.repo, "update")
        .mockResolvedValueOnce(userDoc);

      const jsonPatch = [
        {
          op: UpdateOperations.add,
          path: UserUpdatePaths.stripeCustomerId,
        },
      ];
      const res = await userService.update(id, jsonPatch);
      expect(res).toMatchObject(userDoc);

      expect(modelUpdateMock.mock.calls.length).toBe(1);
      expect(modelUpdateMock.mock.calls[0]).toMatchObject([{ id }, jsonPatch]);
    });
  });

  describe("addReferralIdAndLink", () => {
    const referralId = "mark7211";
    const referralLink = "https://links.foo.bar/CM9E";
    it("Generates and adds a unique id and corresponding link to profile", async () => {
      const updatedDoc = {
        ...userDoc,
        referralId,
        referralLink,
      };

      jest
        .spyOn(userService, "generateReferralId")
        .mockReturnValueOnce(referralId);
      jest.spyOn(userService, "getWithReferralId").mockResolvedValueOnce(null);
      jest
        .spyOn(userService, "generateReferralLink")
        .mockResolvedValueOnce(referralLink);
      jest.spyOn(userService.repo, "update").mockResolvedValueOnce(updatedDoc);

      const updatedUserDoc = await userService.addReferralIdAndLink(userDoc);
      expect(updatedUserDoc).toMatchObject(updatedDoc);
    });

    it("Generates different ids until it's not a duplicate", async () => {
      const updatedDoc = {
        ...userDoc,
        referralId,
        referralLink,
      };

      const generateReferralIdMock = jest
        .spyOn(userService, "generateReferralId")
        .mockReturnValue(referralId);
      jest
        .spyOn(userService, "getWithReferralId")
        .mockResolvedValueOnce(userDoc)
        .mockResolvedValueOnce(userDoc)
        .mockResolvedValueOnce(null);
      jest
        .spyOn(userService, "generateReferralLink")
        .mockResolvedValueOnce(referralLink);
      jest.spyOn(userService.repo, "update").mockResolvedValueOnce(updatedDoc);

      const updatedUserDoc = await userService.addReferralIdAndLink(userDoc);
      expect(updatedUserDoc).toMatchObject(updatedDoc);
      expect(generateReferralIdMock.mock.calls.length).toEqual(3);
    });
  });
});
