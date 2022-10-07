import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import { Recipe } from "server/base/models/recipe";
import { Style } from "server/engine/blend/style";
import {
  ensureServiceAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureServiceAuth(
          BlendMicroServices.Retool,
          createRecipe,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const createRecipe = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const recipe = req.body as Recipe;
  new Style().validate(recipe);
  await diContainer.get<RecipeService>(TYPES.RecipeService).create(recipe);
  res.status(201).send(recipe);
};
