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
  Interaction,
  RecipeWrapper,
} from "server/base/models/recipe";
import BrandingService from "server/service/branding";

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
});

const useRecipeForBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id: blendId } = req.query;
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    CHOOSE_RECIPE_SCHEMA
  ) as ChooseRecipeRequest;
  const { recipeId, variant, fileKeys, encoderVersion } = body;
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );

  const recipe = await recipeService.getRecipe(recipeId, variant);
  if (!recipe) {
    throw new UserError("No such recipe");
  }
  const recipeWrapper = new RecipeWrapper(recipe);

  if (!checkCompatibilityWithElements(recipe, encoderVersion)) {
    throw new UserError(
      "This recipe cannot be used on this app version. Please upgrade the app."
    );
  }

  const copyFilePromises = [];
  let interactionUpdatePromise;

  if (req.uid) {
    await ensureBrandingEntitlement(recipe, req.uid);
    const brandingProfile = await brandingService.getOrCreate(req.uid);
    recipeWrapper.replaceBrandingInfo(brandingProfile);
  }
  if (encoderVersion < 3.0) {
    // Older apps with lesser encoder version won't know how to handle branding
    recipe.interactions = recipe.interactions.filter(
      (i: Interaction) =>
        !["BrandingInfoMetadata", "BrandingLogoMetadata"].includes(i.metadata.$)
    );
  }

  const blendImages = recipe.images.map((image) => {
    if (image.uid === recipe.recipeDetails.elements.hero?.uid) {
      const interaction = recipe.interactions.find(
        (interaction) =>
          interaction.assetType === "IMAGE" &&
          interaction.assetUid === image.uid
      );
      if (fileKeys) {
        recipeWrapper.replaceHero(fileKeys, image, interaction);
        interactionUpdatePromise = adjustSizeToFit(interaction, image.uri);
        return image;
      }
    }
    const uriParts = image.uri.split("/");
    uriParts[0] = blendId as string;
    const targetUri = uriParts.join("/");
    copyFilePromises.push(
      copyObject(
        ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
        image.uri,
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        targetUri
      )
    );
    return { ...image, uri: targetUri };
  });

  await Promise.all(copyFilePromises.concat([interactionUpdatePromise]));

  return res.send({
    ...recipe,
    metadata: {
      ...recipe.metadata,
      sourceRecipeId: recipe.id,
      sourceRecipe: { id: recipe.id, variant: recipe.variant },
    },
    id: blendId,
    images: blendImages,
  });
};
