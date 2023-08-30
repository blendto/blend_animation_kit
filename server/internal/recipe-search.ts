import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { FlowType } from "server/base/models/recipe";
import { handleAxiosCall } from "server/helpers/network";

interface SearchRequestBody {
  query: string;
  flowType: FlowType;
  countryCode: string;
  pageNumber: number;
}

interface SearchResponseBody {
  matchingRecipeLists: {
    id: string;
    score: number;
    recipes: { id: string; variant: string }[];
  }[];
  nextPageNumber: number | null;
}

export default class RecipeSearchService {
  httpClient = axios.create({
    baseURL: `${ConfigProvider.RECIPE_SEARCH_BASE_URL}/api`,
  });

  async search(reqBody: SearchRequestBody) {
    return (
      await handleAxiosCall<SearchResponseBody>(
        async () => await this.httpClient.post("/search", reqBody)
      )
    ).data;
  }
}
