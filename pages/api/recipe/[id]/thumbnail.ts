import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { MethodNotAllowedError } from "server/base/errors";
import { SuggestionService } from "server/service/suggestion";
import { RecipeSource, RecipeVariantId } from "server/base/models/recipeList";
import { getObject } from "server/external/s3";
import { RecipeSourceHandler } from "server/service/recipeSourceHandler";
import Joi from "joi";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getRecipeThumbnail(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

export const RECIPE_VARIANT_ID_SCHEMA = Joi.object({
  id: Joi.string().required(),
  variant: Joi.string(),
  source: Joi.string()
    .valid(...Object.values(RecipeSource))
    .default(RecipeSource.DEFAULT),
});

const getRecipeThumbnail = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const recipeVariant = validate(
    req.query,
    requestComponentToValidate.body,
    RECIPE_VARIANT_ID_SCHEMA
  ) as RecipeVariantId;

  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);
  const {
    source,
    extra: { thumbnail },
  } = await service.backfillRecipeDetails(recipeVariant);
  const bucket = RecipeSourceHandler.from(source).getStorageBucket();

  const buffer = await getObject(bucket, thumbnail);
  res.setHeader("Content-Type", "image/jpeg");
  res.send(buffer);
};
