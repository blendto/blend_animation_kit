import type { NextApiResponse } from "next";
import { UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import Joi from "joi";
import { RecipeSource } from "server/base/models/recipeList";
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

const UPDATE_BODY_SCHEMA = Joi.object({
  favouriteRecipes: Joi.array()
    .items(
      Joi.object({
        recipeId: Joi.string().required(),
        recipeVariant: Joi.string().required(),
        source: Joi.string()
          .valid(...Object.values(RecipeSource))
          .default(RecipeSource.DEFAULT),
      })
    )
    .required(),
});

const updateFavourites = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    UPDATE_BODY_SCHEMA
  ) as {
    favouriteRecipes: FavouriteRecipe[];
  };
  const { favouriteRecipes } = body;
  const userService = diContainer.get<UserService>(TYPES.UserService);
  const user = await userService.updateFavouriteRecipes(
    req.uid,
    favouriteRecipes
  );
  return res.send(user);
};
