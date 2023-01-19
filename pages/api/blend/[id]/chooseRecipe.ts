import type { NextApiResponse } from "next";
import ConfigProvider from "server/base/ConfigProvider";
import { copyObject } from "server/external/s3";
import { adjustSizeToFit } from "server/helpers/imageUtils";
import { checkCompatibilityWithElements } from "server/base/errors/recipeVerification";
import {
  ensureBrandingEntitlement,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import Joi from "joi";
import { diContainer } from "inversify.config";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import {
  ChooseRecipeRequest,
  ElementSource,
  RecipeWrapper,
} from "server/base/models/recipe";
import BrandingService from "server/service/branding";
import { RecipeSource, RecipeVariantId } from "server/base/models/recipeList";
import { isEmpty } from "lodash";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return useRecipeForBlend(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const CHOOSE_RECIPE_SCHEMA = Joi.object({
  recipeId: Joi.string().required(),
  variant: Joi.string(),
  fileKeys: Joi.object({
    original: Joi.string().required(),
    withoutBg: Joi.string().required(),
  }),
  encoderVersion: Joi.number().required(),
  source: Joi.string()
    .valid(...Object.values(RecipeSource))
    .default(RecipeSource.DEFAULT),
});

const useRecipeForBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { ip } = req;
  const { id: blendId } = req.query;
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    CHOOSE_RECIPE_SCHEMA
  ) as ChooseRecipeRequest;
  const { recipeId, variant, fileKeys, encoderVersion, source } = body;
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );

  const recipe =
    source === RecipeSource.DEFAULT
      ? await recipeService.getRecipeOrFail(recipeId, variant)
      : await brandingService.useRecipe(req.uid, recipeId, variant);
  const recipeWrapper = new RecipeWrapper(recipe);

  if (!checkCompatibilityWithElements(recipe, encoderVersion)) {
    throw new UserError(
      "This recipe cannot be used on this app version. Please upgrade the app."
    );
  }

  const copyFilePromises = [];
  let interactionUpdatePromise;

  if (req.uid) {
    await ensureBrandingEntitlement(recipe, source, req.uid);
    if (!isEmpty(recipe.branding)) {
      const brandingProfile = await brandingService.get(req.uid);
      if (brandingProfile) {
        await recipeService.replaceBrandingInfo(recipe, brandingProfile, ip);
      } else {
        recipeWrapper.cleanupBranding();
      }
    }
  }
  if (encoderVersion < 3.0) {
    // Older apps with lesser encoder version won't know how to handle branding
    recipeWrapper.cleanupBranding();
  }

  if (fileKeys) {
    const { image, interaction } = recipeWrapper.replaceHero(fileKeys);
    interactionUpdatePromise = adjustSizeToFit(interaction, image.uri);
  }
  const blendImages = recipe.images.map((image) => {
    if (fileKeys && image.uid === recipe.recipeDetails.elements.hero?.uid) {
      return image;
    }
    const uriParts = image.uri.split("/");
    uriParts[0] = blendId as string;
    const targetUri = uriParts.join("/");
    copyFilePromises.push(
      copyObject(
        source === RecipeSource.DEFAULT
          ? ConfigProvider.RECIPE_INGREDIENTS_BUCKET
          : ConfigProvider.BRANDING_BUCKET,
        image.uri,
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        targetUri
      )
    );
    return { ...image, uri: targetUri, source: ElementSource.blend };
  });

  await Promise.all(copyFilePromises.concat([interactionUpdatePromise]));

  const sourceRecipe: RecipeVariantId = {
    id: recipeId,
    variant,
    extra: {
      title: recipe.title,
      thumbnail: recipe.thumbnail,
      isPremium:
        source === RecipeSource.DEFAULT ? recipe.recipeDetails.isPremium : true,
    },
    source,
  };
  return res.send({
    ...recipe,
    metadata: {
      ...recipe.metadata,
      sourceRecipeId: recipe.id,
      sourceRecipe,
    },
    id: blendId,
    images: blendImages,
    heroImages: fileKeys,
  });
};
