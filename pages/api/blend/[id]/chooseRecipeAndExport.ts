import { isEmpty } from "lodash";
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
import {
  ChooseRecipeRequest,
  RecipeMutationsSchema,
  RecipeWrapper,
  ReplacementTexts,
} from "server/base/models/recipe";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { RecipeService } from "server/service/recipe";
import { CreditsService } from "server/service/credits";
import BrandingService from "server/service/branding";
import { RecipeSource } from "server/base/models/recipeList";
import { RecipeChoosePrepAgent } from "server/engine/blend/recipeAgents";
import { P2DCreationLogAction } from "server/base/models/p2d";
import { P2DCreationLogRepository } from "server/repositories/p2d-creation-log";
import { fireAndForget } from "server/helpers/async-runner";

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
  }),
  source: Joi.string()
    .valid(...Object.values(RecipeSource))
    .default(RecipeSource.DEFAULT),
  replacementTexts: Joi.object({
    title: Joi.string(),
    subtitle: Joi.string(),
    ctaText: Joi.string(),
    offerText: Joi.string(),
  }),
  mutations: RecipeMutationsSchema,
  replacementBrandingLogo: Joi.string(),
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
  ) as ChooseRecipeRequest & {
    replacementTexts: ReplacementTexts;
    replacementBrandingLogo: string;
  };
  const {
    recipeId,
    variant,
    fileKeys,
    source,
    replacementTexts,
    replacementBrandingLogo,
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

  const service = diContainer.get<BlendService>(TYPES.BlendService);
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const recipe =
    source === RecipeSource.DEFAULT
      ? await recipeService.getRecipeOrFail(recipeId, variant)
      : await brandingService.getRecipeOrFail(recipeId, variant);

  const creditsService = diContainer.get<CreditsService>(TYPES.CreditsService);
  await creditsService.runWithCreditAndWatermarkCheck(
    req.uid,
    id,
    req.buildVersion,
    req.clientType,
    async (shouldWatermark) => {
      const recipePrepAgent = new RecipeChoosePrepAgent({
        recipe,
        blendService: service,
        blendId: id,
        recipeService,
        brandingService,
      });

      if (!isEmpty(recipe.branding)) {
        await recipePrepAgent.applyBranding(req.uid, req.ip);
      }

      if (mutations) {
        await recipePrepAgent.applyMutations(mutations);
        // HACK: In the future if we use mutations for anything other than P2D,
        // this log would be wrong
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        fireAndForget(() =>
          diContainer
            .get<P2DCreationLogRepository>(TYPES.P2DCreationLogRepo)
            .log({
              suggestions: [{ ...body, id: recipeId, variant }],
              blendId: id,
              action: P2DCreationLogAction.CHOOSE,
              userId: req.uid,
            })
        );
      }

      const recipeBody = await service.copyRecipeToBlendWithSource(
        id,
        fileKeys,
        recipe,
        shouldWatermark
      );

      if (shouldWatermark) {
        new RecipeWrapper(recipeBody).addWatermark();
      }

      const output: object = await new VesApi().saveExport({
        body: recipeBody,
        schema: ExportRequestSchema.Blend,
      });

      return res.send(output);
    }
  );
};
