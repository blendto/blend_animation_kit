import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { BatchV2Service } from "server/service/batch-v2";
import { BatchBlend } from "server/base/models/batch-v2";
import { RecipeVariantId } from "server/base/models/recipeList";
import { MethodNotAllowedError } from "server/base/errors";
import Joi from "joi";
import { RECIPE_VARIANT_ID_SCHEMA } from "pages/api/recipe/[id]/thumbnail";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(updateBlendsInBatch, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const BATCH_UPDATE_SCHEMA = Joi.object({
  blends: Joi.array()
    .items(
      Joi.object({
        blendId: Joi.string().required(),
        index: Joi.number().required(),
      })
    )
    .required(),
  baseRecipe: Joi.object(RECIPE_VARIANT_ID_SCHEMA).required(),
});

const updateBlendsInBatch = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    uid,
    query: { id },
  } = req;
  const batchId = id as string;
  const { blends, baseRecipe } = req.body as {
    blends: BatchBlend[];
    baseRecipe: RecipeVariantId;
  };

  validate(req.query, requestComponentToValidate.body, BATCH_UPDATE_SCHEMA);

  const batchService = diContainer.get<BatchV2Service>(TYPES.BatchV2Service);
  const batch = await batchService.updateBatch(
    batchId,
    uid,
    blends,
    baseRecipe
  );
  res.send(batch);
};
