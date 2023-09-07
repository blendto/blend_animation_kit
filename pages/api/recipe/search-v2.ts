import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import { FlowType } from "server/base/models/recipe";
import IpApi from "server/external/ipapi";
import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import RecipeSearchService from "server/internal/recipe-search";
import RecoEngineApi, {
  ProcessSearchResultsResponseBody,
} from "server/internal/reco-engine";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";

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

const SEARCH_REQ_SCHEMA = Joi.object({
  query: Joi.string().required(),
  filters: Joi.object({ aspectRatio: Joi.string() }),
  pageNumber: Joi.number().required(),
  flowType: Joi.string()
    .valid(FlowType.ASSISTED_MOBILE, FlowType.START_WITH_A_TEMPLATE)
    .default(FlowType.ASSISTED_MOBILE),
  fileKeys: Joi.object({
    withoutBg: Joi.string().required(),
  }).when("flowType", { is: FlowType.ASSISTED_MOBILE, then: Joi.required() }),
});

const ipApi = new IpApi();
const searchService = new RecipeSearchService();
const recoEngine = new RecoEngineApi();

const searchRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { query, flowType, fileKeys, filters, pageNumber } = validate(
    req.body as object,
    requestComponentToValidate.body,
    SEARCH_REQ_SCHEMA
  ) as {
    query: string;
    flowType: FlowType;
    fileKeys?: { withoutBg: string };
    filters?: { aspectRatio?: string };
    pageNumber: number;
  };

  const { ip } = req;
  if (!ip) {
    throw new UserError(
      "IP_IS_MISSING",
      "Pass user ip via x-forwarded-for header"
    );
  }
  const ipDetails = await ipApi.getIpInfo(ip);
  const countryCode = ipDetails.country_code;

  const { matchingRecipeLists, nextPageNumber } = await searchService.search({
    query,
    flowType,
    countryCode,
    pageNumber,
  });
  matchingRecipeLists.forEach((l) => {
    const [tableName, id] = l.id.split("/");
    l.id = id;
  });

  let processedResults: ProcessSearchResultsResponseBody = {
    suggestedRecipes: [],
  };
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  switch (flowType) {
    case FlowType.ASSISTED_MOBILE:
      processedResults = await recoEngine.processSearchResults({
        fileKeys,
        filters,
        flow: FlowType.ASSISTED_MOBILE,
        recipeLists: matchingRecipeLists,
      });
      break;
    case FlowType.START_WITH_A_TEMPLATE:
      processedResults.suggestedRecipes = (
        await recipeService.getRecipes(
          matchingRecipeLists.flatMap((l) => l.recipes),
          "id, variant, thumbnail, recipeDetails.isPremium"
        )
      ).map((r) => ({
        id: r.id,
        variant: r.variant,
        extra: {
          thumbnail: r.thumbnail,
          isPremium: r.recipeDetails.isPremium,
        },
      }));
      break;
    default:
      throw new Error("UNSUPPORTED_FLOW_TYPE");
  }
  res.send({
    ...processedResults,
    nextPageNumber,
  });
};
