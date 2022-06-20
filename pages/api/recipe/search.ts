import { NextApiResponse } from "next";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import RecoEngineApi from "server/internal/reco-engine";
import { MethodNotAllowedError } from "server/base/errors";
import { diContainer } from "inversify.config";
import { SuggestionService } from "server/service/suggestion";
import { TYPES } from "server/types";
import { SearchRecipeResponse } from "server/base/models/recipe";

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

const searchRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const searchResponse = (await new RecoEngineApi().searchRecipes(
    req.query,
    req.body
  )) as SearchRecipeResponse;

  const suggestionService = diContainer.get<SuggestionService>(
    TYPES.SuggestionService
  );

  const promises = searchResponse.suggestedRecipes.map((recipeVariant) =>
    suggestionService.backfillRecipeDetails(recipeVariant)
  );

  await Promise.all(promises);

  res.send(searchResponse);
};
