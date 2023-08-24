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
import RecoEngineApi from "server/internal/reco-engine";

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
  fileKeys: Joi.object({
    withoutBg: Joi.string().required(),
  }).required(),
  filters: Joi.object({ aspectRatio: Joi.string() }),
  pageNumber: Joi.number().required(),
});

const ipApi = new IpApi();
const searchService = new RecipeSearchService();
const recoEngine = new RecoEngineApi();

const searchRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { query, fileKeys, filters, pageNumber } = validate(
    req.body as object,
    requestComponentToValidate.body,
    SEARCH_REQ_SCHEMA
  ) as {
    query: string;
    fileKeys: { withoutBg: string };
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
    countryCode,
    pageNumber,
  });

  res.send({
    ...(await recoEngine.processSearchResults({
      fileKeys,
      filters,
      flow: FlowType.ASSISTED_MOBILE,
      recipeLists: matchingRecipeLists,
    })),
    nextPageNumber,
  });
};
