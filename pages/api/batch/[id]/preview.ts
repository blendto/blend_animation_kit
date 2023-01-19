import type { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { SuggestionService } from "server/service/suggestion";
import { TYPES } from "server/types";
import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { RecipeSource } from "server/base/models/recipeList";
import { PreviewService } from "server/service/preview";
import Joi from "joi";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return generatePreview(req, res);
      default:
        res.status(405).end();
    }
  }
);

const GEN_PREV_SCHEMA = Joi.object({
  recipeId: Joi.string().required(),
  variant: Joi.string(),
  source: Joi.string()
    .valid(...Object.values(RecipeSource))
    .default(RecipeSource.DEFAULT),
});

const generatePreview = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { ip } = req;
  const { uid } = req;
  const batchId = req.query.id as string;
  validate(
    req.body as object,
    requestComponentToValidate.body,
    GEN_PREV_SCHEMA
  );
  const { recipeId, variant, source } = req.body as {
    recipeId: string;
    variant?: string;
    source: RecipeSource;
  };

  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);
  const fileKeys = await service.selectFileKeysFromBatchPreview(
    req.uid,
    batchId
  );

  const previewService = diContainer.get<PreviewService>(TYPES.PreviewService);
  const previewStream = await previewService.generate({
    ip,
    uid,
    recipeId,
    variant,
    fileKeys,
    source,
  });
  res.setHeader("Content-Type", "image/jpeg");
  res.send(previewStream);
};
