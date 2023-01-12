import type { NextApiResponse } from "next";
import { Blend, BlendVersion } from "server/base/models/blend";
import { ImageFileKeys } from "server/base/models/heroImage";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import { SuggestionService } from "server/service/suggestion";
import {
  FlowType,
  SuggestRecipesPaginatedRequestBody,
} from "server/base/models/recipe";

import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { FileKeysProcessingStrategy } from "server/service/fileKeysProcessingStrategy";
import { MethodNotAllowedError } from "server/base/errors";
import { plainToClass } from "class-transformer";
import { ClassificationMetadata } from "server/base/models/removeBg";
import Joi from "joi";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(suggestRecipesV2, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const SuggestRecipesPaginatedSchema = Joi.object({
  fileKeys: Joi.object({
    original: Joi.string().required(),
    withoutBg: Joi.string().required(),
  })
    .allow(null)
    .unknown(true)
    .optional(),
  heroImageId: Joi.string().allow(null),
  pageKey: Joi.number().optional().allow(null),
  userChosenSuperClass: Joi.string().optional().allow(null),
  filters: Joi.object().unknown(true).allow(null),
  flow: Joi.string()
    .valid(...Object.values(FlowType))
    .default(FlowType.ASSISTED_MOBILE),
});

const suggestRecipesV2 = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
  } = req;

  const body = req.body as SuggestRecipesPaginatedRequestBody;

  /**
   *  Avoid using heroImageId here. Instead, use chooseHeroImage and pass the fileKeys
   */
  const {
    fileKeys,
    pageKey,
    heroImageId,
    userChosenSuperClass,
    filters,
    flow,
  } = validate(
    body,
    requestComponentToValidate.body,
    SuggestRecipesPaginatedSchema,
    true,
    true
  ) as SuggestRecipesPaginatedRequestBody;

  if (!heroImageId && !fileKeys?.original) {
    res.status(400).send({ message: "Invalid filekeys / heroImageId" });
    return;
  }

  const blend: Blend = await diContainer
    .get<BlendService>(TYPES.BlendService)
    .getBlend(id as string, BlendVersion.current, true);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  let classificationMetadata = plainToClass(
    ClassificationMetadata,
    blend.heroImages?.classificationMetadata
  );

  const ip = req.headers["x-forwarded-for"] as string;

  const fileKeysProcessor = FileKeysProcessingStrategy.choose(
    id as string,
    req.uid,
    fileKeys,
    heroImageId
  );

  const finalisedFileKeys: ImageFileKeys = await fileKeysProcessor.process();

  const suggestionService = diContainer.get<SuggestionService>(
    TYPES.SuggestionService
  );

  const suggestions = await suggestionService.suggestRecipesPaginated({
    uid: req.uid,
    fileKey: finalisedFileKeys.withoutBg,
    ip,
    pageKey,
    productSuperCategory:
      userChosenSuperClass ?? classificationMetadata?.superClass,
    filters,
    flow,
  });

  const promises = suggestions.recipeLists.map((recipeList) =>
    suggestionService.recipeListMapper(recipeList)
  );

  const recipeLists = await Promise.all(promises);

  if (
    userChosenSuperClass &&
    classificationMetadata?.userChosenSuperClass !== userChosenSuperClass
  ) {
    const blendService = diContainer.get<BlendService>(TYPES.BlendService);

    classificationMetadata = plainToClass(ClassificationMetadata, {
      ...classificationMetadata,
      userChosenSuperClass,
    });
    await blendService.addOrUpdateImageFileKeys(blend, {
      ...blend.heroImages,
      classificationMetadata,
    });
  }

  return res.send({
    fileKeys: finalisedFileKeys,
    suggestedRecipes: recipeLists,
    classificationMetadata,
    nextPageKey: suggestions.nextPageKey,
  });
};
