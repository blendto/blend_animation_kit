import type { NextApiResponse } from "next";
import Joi from "joi";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { ChooseRecipeRequest, RecipeWrapper } from "server/base/models/recipe";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { RecipeService } from "server/service/recipe";
import { CreditsService } from "server/service/credits";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "POST":
        await ensureAuth(chooseRecipeAndExportSync, req, res);
        break;
      default:
        res.status(400).json({ code: 400, message: "Invalid request" });
    }
  }
);

const CHOOSE_AND_EXPORT_SCHEMA = Joi.object({
  recipeId: Joi.string().required(),
  variant: Joi.string(),
  fileKeys: Joi.object({
    original: Joi.string().required(),
    withoutBg: Joi.string().required(),
  }).required(),
  replacementTexts: Joi.object({
    title: Joi.string(),
    subtitle: Joi.string(),
    ctaText: Joi.string(),
    offerText: Joi.string(),
  }),
});

const chooseRecipeAndExportSync = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    CHOOSE_AND_EXPORT_SCHEMA
  ) as ChooseRecipeRequest;
  const { recipeId, variant, fileKeys, replacementTexts } = body;

  const service = diContainer.get<BlendService>(TYPES.BlendService);
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  const recipe = await recipeService.getRecipe(recipeId, variant);

  const creditsService = diContainer.get<CreditsService>(TYPES.CreditsService);
  await creditsService.runWithCreditAndWatermarkCheck(
    req.uid,
    id,
    req.buildVersion,
    req.clientType,
    async (shouldWatermark) => {
      if (replacementTexts) {
        new RecipeWrapper(recipe).replaceTexts(replacementTexts);
      }

      const body = await service.copyRecipeToBlendWithSource(
        id,
        fileKeys,
        recipe,
        shouldWatermark
      );
      if (shouldWatermark) {
        new RecipeWrapper(body).addWatermark();
      }

      const output = await new VesApi().saveExport({
        body,
        schema: ExportRequestSchema.Blend,
      });

      return res.send(output);
    }
  );
};
