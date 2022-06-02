import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { SuggestionService } from "server/service/suggestion";
import { TYPES } from "server/types";
import { MethodNotAllowedError } from "server/base/errors";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return fetchHomepageRecipes(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const fetchHomepageRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);
  const recipeSuggestions = await service.suggestHomePageRecipes();
  res.send(recipeSuggestions);
};
