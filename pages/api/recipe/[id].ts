import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiRequest, NextApiResponse } from "next";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import {
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getRecipe(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const GET_RECIPE_SCHEMA = Joi.object({
  id: Joi.string().required(),
  variant: Joi.string(),
});

const getRecipe = async (req: NextApiRequest, res: NextApiResponse) => {
  const query = validate(
    req.query as object,
    requestComponentToValidate.query,
    GET_RECIPE_SCHEMA
  ) as { id: string; variant?: string };
  const { id, variant } = query;
  const recipe = await diContainer
    .get<RecipeService>(TYPES.RecipeService)
    .getRecipe(id, variant);
  if (recipe) {
    return res.send(recipe);
  }
  throw new UserError("Invalid id and/or variant");
};
