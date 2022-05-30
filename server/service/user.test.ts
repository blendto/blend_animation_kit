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
  const recipeId = "zxDJ2pQfNePtfOO1dH5AhHKQka11";
  const recipeVariant = "1*1";
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
    favouriteRecipes: [
      {
        recipeId,
        recipeVariant,
      },
    ],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Update", () => {
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
});
