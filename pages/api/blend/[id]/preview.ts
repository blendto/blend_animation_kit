import { diContainer } from "inversify.config";
import Joi from "joi";
import type { NextApiResponse } from "next";
import { Recipe, RecipeWrapper } from "server/base/models/recipe";

import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import BrandingService from "server/service/branding";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";
import { fireAndForget } from "server/helpers/async-runner";
import { BrandingRecipe } from "server/base/models/brandingRecipe";
import { RecipeSource } from "server/base/models/recipeList";

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

const vesapi = new VesApi();

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

function saveRecipeThumbnailAsync(recipe: Recipe) {
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  fireAndForget(() => recipeService.saveRecipeThumbnail(recipe), {
    operationName: "SAVING_RECIPE_THUMBNAIL",
  }).catch(() => {});
}

const generatePreview = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    GEN_PREV_SCHEMA
  ) as {
    recipeId: string;
    variant?: string;
    fileKeys: {
      original: string;
      withoutBg: string;
    };
    source: RecipeSource;
  };
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );

  const recipe =
    body.source === RecipeSource.DEFAULT
      ? await recipeService.getRecipeOrFail(body.recipeId, body.variant)
      : await brandingService.getRecipeOrFail(body.recipeId, body.variant);
  const recipeWrapper = new RecipeWrapper(recipe);
  if (!recipe.thumbnail && body.source === RecipeSource.DEFAULT) {
    // Deprecated. Newer recipe previews are generated synchronously during creation.
    saveRecipeThumbnailAsync(
      JSON.parse(JSON.stringify(recipe)) as Recipe | BrandingRecipe
    );
  }

  recipeWrapper.replaceHero(body.fileKeys);
  if (req.uid) {
    const brandingProfile = await brandingService.get(req.uid);
    if (brandingProfile) recipeWrapper.replaceBrandingInfo(brandingProfile);
  }

  const previewStream = await vesapi.previewV2({
    body: recipe,
    schema: ExportRequestSchema.Recipe,
  });
  res.setHeader("Content-Type", "image/jpeg");
  res.send(previewStream);
};
