import { NextApiResponse } from "next";
import Joi from "joi";
import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import RecoEngineApi, {
  SearchRecipesClientRequestBody,
} from "server/internal/reco-engine";
import { MethodNotAllowedError } from "server/base/errors";
import { diContainer } from "inversify.config";
import { SuggestionService } from "server/service/suggestion";
import { TYPES } from "server/types";
import { getUserAgentDetails } from "pages/api/whoami";
import { FlowType } from "server/base/models/recipe";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return searchRecipes(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const SearchRecipesSchema = Joi.object({
  fileKeys: Joi.object({
    hero: Joi.string().optional(),
    original: Joi.string().optional(),
    withoutBg: Joi.string().optional(),
  }),
  pageKey: Joi.number().optional().allow(null),
  parameters: Joi.object({
    searchQuery: Joi.string(),
  }),
  flow: Joi.string()
    .valid(...Object.values(FlowType))
    .default(FlowType.ASSISTED_MOBILE),
});

const searchRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const userAgentDetails = await getUserAgentDetails(req);
  const body = req.body as SearchRecipesClientRequestBody;
  const { parameters, flow, pageKey, fileKeys } = validate(
    body,
    requestComponentToValidate.body,
    SearchRecipesSchema,
    true,
    true
  ) as SearchRecipesClientRequestBody;
  const searchResponse = await new RecoEngineApi().searchRecipes({
    parameters,
    pageKey,
    fileKeys,
    flow,
    userAgentDetails,
  });

  const suggestionService = diContainer.get<SuggestionService>(
    TYPES.SuggestionService
  );

  const promises = searchResponse.suggestedRecipes.map((recipeVariant) =>
    suggestionService.backfillRecipeDetails(recipeVariant)
  );

  await Promise.all(promises);

  res.send(searchResponse);
};
