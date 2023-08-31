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
import {
  RecipeMutations,
  RecipeMutationsSchema,
  ReplacementTexts,
} from "server/base/models/recipe";
import { RecipeService } from "server/service/recipe";
import { fireAndForget } from "server/helpers/async-runner";

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
  variant: Joi.string().required(),
  fileKeys: Joi.object({
    original: Joi.string().required(),
    withoutBg: Joi.string().required(),
  }).optional(),
  source: Joi.string()
    .valid(...Object.values(RecipeSource))
    .default(RecipeSource.DEFAULT),
  // TODO: Deprecate replacementTexts and replacementBrandingLogo
  replacementTexts: Joi.object({
    title: Joi.string(),
    subtitle: Joi.string(),
    ctaText: Joi.string(),
    offerText: Joi.string(),
  }),
  replacementBrandingLogo: Joi.string(),
  mutations: RecipeMutationsSchema,
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
    variant: string;
    fileKeys: ImageFileKeys;
    source: RecipeSource;
    replacementTexts?: ReplacementTexts;
    replacementBrandingLogo?: string;
    mutations: RecipeMutations;
  };

  // TODO: This is for temporary backward compatibility
  // Remove it after DaaS and delete bg is updated
  const {
    replacementTexts,
    replacementBrandingLogo,
    ...bodyWithoutDeprecatedFields
  } = body;

  let { mutations } = body;

  if (replacementTexts) {
    if (!mutations) mutations = {};
    mutations.texts = replacementTexts;
  }

  if (replacementBrandingLogo) {
    if (!mutations) mutations = {};
    mutations.branding = {
      logo: replacementBrandingLogo,
    };
  }

  // TODO: This is for async migration, delete this in the near future
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  fireAndForget(() =>
    recipeService.migrateBackground(body.recipeId, body.variant)
  ).catch();

  const previewService = diContainer.get<PreviewService>(TYPES.PreviewService);
  const previewStream = await previewService.generate({
    ip,
    uid,
    ...bodyWithoutDeprecatedFields,
    mutations,
  });
  res.setHeader("Content-Type", "image/jpeg");
  res.send(previewStream);
};
