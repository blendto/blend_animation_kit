import { diContainer } from "inversify.config";

import { TYPES } from "server/types";
import { User } from "server/base/models/user";
import { UpdateOperations } from "server/repositories";
import { UserUpdatePaths } from "server/repositories/user";
import { UserService } from "server/service/user";

describe("UserService", () => {
  const userService = diContainer.get<UserService>(TYPES.UserService);
  const id = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const email = "engg@blend.to";
  const stripeCustomerId = "cus_4QE4bx4C5BVSrC";
  const createdAt = Date.now();
  const updatedAt = createdAt;
  const userDoc: User = {
    id,
    email,
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
  const referralId = "mark7211";
  const referralLink = "https://links.foo.bar/CM9E";

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("update", () => {
    it("Supports updating stripe customer id", async () => {
      const modelUpdateMock = jest
        .spyOn(userService.repo, "update")
        .mockResolvedValueOnce(userDoc);
      jest
        .spyOn(userService, "ensureProfileHasAllData")
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

  describe("generateReferralIdAndLink", () => {
    it("Generates a unique id and corresponding link to profile", async () => {
      jest
        .spyOn(userService, "generateReferralId")
        .mockReturnValueOnce(referralId);
      jest.spyOn(userService, "getWithReferralId").mockResolvedValueOnce(null);
      jest
        .spyOn(userService, "generateReferralLink")
        .mockResolvedValueOnce(referralLink);

      expect(
        await userService.generateReferralIdAndLink(userDoc)
      ).toMatchObject({ referralId, referralLink });
    });

    it("Generates different ids until it's not a duplicate", async () => {
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

      expect(
        await userService.generateReferralIdAndLink(userDoc)
      ).toMatchObject({ referralId, referralLink });
      expect(generateReferralIdMock.mock.calls.length).toEqual(3);
    });

    it("Doesn't generate data if the user has no email nor phone number meaning they haven't signed up", async () => {
      jest
        .spyOn(userService, "generateReferralId")
        .mockReturnValueOnce(referralId);
      jest.spyOn(userService, "getWithReferralId").mockResolvedValueOnce(null);
      jest
        .spyOn(userService, "generateReferralLink")
        .mockResolvedValueOnce(referralLink);

      let email: string;
      expect(
        await userService.generateReferralIdAndLink({ ...userDoc, email })
      ).toMatchObject({ referralId: undefined, referralLink: undefined });
    });
  });

  describe("generateBaseDataChanges", () => {
    const anonymousUserFirebaseResponse = {
      email: undefined,
      displayName: undefined,
      phoneNumber: undefined,
      photoURL: undefined,
      createdAt,
    };
    const displayName = "Engineer Mahaan";
    const phoneNumber = "+91 888 777 6666";
    const signedUserFirebaseResponse = {
      email,
      displayName,
      phoneNumber,
      photoURL: undefined,
      createdAt,
    };
    it("Generates JSON patch with all missing non-signup values for anonymous user", async () => {
      jest
        .spyOn(userService, "generateFirebaseData")
        .mockResolvedValueOnce(anonymousUserFirebaseResponse);

      expect(
        await userService.generateBaseDataChanges({
          id,
          socialHandles: {},
          updatedAt,
        })
      ).toMatchObject([
        {
          op: "add",
          path: `/activitySummary`,
          value: {
            posts: 0,
            shoutoutsReceived: 0,
          },
        },
        {
          op: "add",
          path: `/createdAt`,
          value: createdAt,
        },
        {
          op: "add",
          path: `/favouriteRecipes`,
          value: [],
        },
      ]);
    });

    it("Generates JSON patch with all missing values for signed-up user", async () => {
      jest
        .spyOn(userService, "generateFirebaseData")
        .mockResolvedValueOnce(signedUserFirebaseResponse);

      expect(
        await userService.generateBaseDataChanges({
          id,
          socialHandles: {},
          updatedAt,
        })
      ).toMatchObject([
        {
          op: "add",
          path: `/email`,
          value: email,
        },
        {
          op: "add",
          path: `/name`,
          value: displayName,
        },
        {
          op: "add",
          path: `/phone`,
          value: phoneNumber,
        },
        {
          op: "add",
          path: `/activitySummary`,
          value: {
            posts: 0,
            shoutoutsReceived: 0,
          },
        },
        {
          op: "add",
          path: `/createdAt`,
          value: createdAt,
        },
        {
          op: "add",
          path: `/favouriteRecipes`,
          value: [],
        },
      ]);
    });
  });

  describe("generateReferralDataChanges", () => {
    it("Generates JSON patch with id and corresponding link", async () => {
      jest
        .spyOn(userService, "generateReferralId")
        .mockReturnValueOnce(referralId);
      jest.spyOn(userService, "getWithReferralId").mockResolvedValueOnce(null);
      jest
        .spyOn(userService, "generateReferralLink")
        .mockResolvedValueOnce(referralLink);

      expect(
        await userService.generateReferralDataChanges(userDoc)
      ).toMatchObject([
        {
          op: "add",
          path: `/referralId`,
          value: referralId,
        },
        {
          op: "add",
          path: `/referralLink`,
          value: referralLink,
        },
      ]);
    });
  });
});
