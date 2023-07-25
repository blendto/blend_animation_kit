import type { NextApiResponse } from "next";
import ConfigProvider from "server/base/ConfigProvider";
import { copyObject } from "server/external/s3";
import { adjustSizeToFit } from "server/helpers/imageUtils";
import { checkCompatibilityWithElements } from "server/base/errors/recipeVerification";
import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import Joi from "joi";
import { diContainer } from "inversify.config";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";
import {
  MethodNotAllowedError,
  ObjectNotFoundError,
  UnauthorizedError,
  UserError,
} from "server/base/errors";
import {
  ChooseRecipeRequest,
  ElementSource,
  RecipeMutationsSchema,
  RecipeWrapper,
  StoredImage,
} from "server/base/models/recipe";
import BrandingService from "server/service/branding";
import { RecipeSource, RecipeVariantId } from "server/base/models/recipeList";
import { isEmpty } from "lodash";
import SubscriptionService from "server/service/subscription";
import { RecipeSourceHandler } from "server/service/recipeSourceHandler";
import { BlendService } from "server/service/blend";
import { RecipeChoosePrepAgent } from "server/engine/blend/recipeAgents";
import { P2DCreationLogAction } from "server/base/models/p2d";
import { P2DCreationLogRepository } from "server/repositories/p2d-creation-log";
import { fireAndForget } from "server/helpers/async-runner";

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
  mutations: RecipeMutationsSchema,
  retainAssetSource: Joi.boolean().default(false),
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
  const { id: blendId } = req.query as { id: string };
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    CHOOSE_RECIPE_SCHEMA
  ) as ChooseRecipeRequest;
  const {
    recipeId,
    variant,
    fileKeys,
    mutations,
    encoderVersion,
    source,
    retainAssetSource,
  } = body;
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const subService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );

  const blend = await blendService.getBlend(blendId);

  if (!blend) {
    throw new ObjectNotFoundError("Blend not found");
  }

  if (blend.createdBy !== req.uid) {
    throw new UnauthorizedError("You are not authorized to use this blend");
  }

  const recipeSrcHandler = RecipeSourceHandler.from(source);

  const recipe = await recipeSrcHandler.getRecipe(req.uid, recipeId, variant);
  const recipeWrapper = new RecipeWrapper(recipe);
  if (!checkCompatibilityWithElements(recipe, encoderVersion)) {
    throw new UserError(
      "This recipe cannot be used on this app version. Please upgrade the app."
    );
  }

  const recipePrepAgent = new RecipeChoosePrepAgent({
    recipe,
    blendService,
    blendId,
    brandingService,
    recipeService,
  });

  const copyFilePromises = [];
  let interactionUpdatePromise: Promise<void>;

  if (req.uid) {
    if (encoderVersion < 3.0) {
      // Older apps with lesser encoder version won't know how to handle branding
      recipeWrapper.cleanupBranding();
    }
    await subService.ensureBrandingEntitlement(recipe, source, req.uid);
    if (!isEmpty(recipe.branding)) {
      await recipePrepAgent.applyBranding(req.uid, ip);
    }
  }

  if (mutations) {
    await recipePrepAgent.applyMutations(mutations);
    // HACK: In the future if we use mutations for anything other than P2D,
    // this log would be wrong
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fireAndForget(
      () =>
        diContainer
          .get<P2DCreationLogRepository>(TYPES.P2DCreationLogRepo)
          .log({
            suggestions: [{ ...body, id: recipeId, variant }],
            blendId,
            action: P2DCreationLogAction.CHOOSE,
            userId: req.uid,
          }),
      { operationName: "chooseRecipe-P2DLog" }
    );
  }

  if (fileKeys) {
    const replacementDetails = recipeWrapper.replaceHero(fileKeys);
    if (replacementDetails) {
      interactionUpdatePromise = adjustSizeToFit(
        replacementDetails.interaction,
        replacementDetails.image.uri
      );
    }
  }

  const blendImages = recipe.images.map((image): StoredImage => {
    if (fileKeys && image.uid === recipe.recipeDetails.elements.hero?.uid) {
      return image;
    }
    if (retainAssetSource) {
      return {
        ...image,
        source: image.source ?? recipeSrcHandler.getElementSource(),
      };
    }
    const uriParts = image.uri.split("/");
    uriParts[0] = blendId;
    const targetUri = uriParts.join("/");
    copyFilePromises.push(
      copyObject(
        recipeSrcHandler.getStorageBucket(),
        image.uri,
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        targetUri
      )
    );
    return { ...image, uri: targetUri, source: ElementSource.blend };
  });

  await Promise.all(
    copyFilePromises.concat(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      interactionUpdatePromise ? [interactionUpdatePromise] : []
    )
  );

  const sourceRecipe: RecipeVariantId = {
    id: recipeId,
    variant,
    extra: {
      title: recipe.title,
      thumbnail: recipe.thumbnail,
      isPremium: recipeSrcHandler.isPremium(recipe),
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
