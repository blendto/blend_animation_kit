import { NextApiResponse } from "next";
import {
  ensureServiceAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { RecipeService } from "server/service/recipe";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import Joi from "joi";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureServiceAuth(
          BlendMicroServices.AWSTriggerHandlers,
          optimize,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const OPTIMIZE_SCHEMA = Joi.object({
  variant: Joi.string().required(),
});

const optimize = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    OPTIMIZE_SCHEMA
  );
  const { id } = req.query as { id: string };
  const { variant } = req.body as {
    variant: string;
  };

  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  const recipe = await recipeService.getRecipeOrFail(id, variant);

  res.send(await recipeService.optimize(recipe));
};
