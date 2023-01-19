import { diContainer } from "inversify.config";
import Joi from "joi";
import type { NextApiResponse } from "next";

import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { TYPES } from "server/types";
import { RecipeSource } from "server/base/models/recipeList";
import { PreviewService } from "server/service/preview";
import { ImageFileKeys } from "server/base/models/heroImage";

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
  fileKeys: Joi.object({
    original: Joi.string().required(),
    withoutBg: Joi.string().required(),
  }).required(),
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
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    GEN_PREV_SCHEMA
  ) as {
    recipeId: string;
    variant?: string;
    fileKeys: ImageFileKeys;
    source: RecipeSource;
  };

  const previewService = diContainer.get<PreviewService>(TYPES.PreviewService);
  const previewStream = await previewService.generate({ ip, uid, ...body });
  res.setHeader("Content-Type", "image/jpeg");
  res.send(previewStream);
};
