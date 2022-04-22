import type { NextApiResponse } from "next";
import { UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { FavouriteRecipe } from "server/base/models/user";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "POST":
        await ensureAuth(updateFavourites, req, res);
        break;
      default:
        res.status(400).json({ code: 400, message: "Invalid request" });
    }
  }
);

const updateFavourites = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { favouriteRecipes } = req.body as {
    favouriteRecipes: FavouriteRecipe[];
  };
  const userService = diContainer.get<UserService>(TYPES.UserService);
  const user = await userService.updateFavouriteRecipes(
    req.uid,
    favouriteRecipes
  );
  return res.send(user);
};
