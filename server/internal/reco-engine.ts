import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { RecipeList } from "server/base/models/recipeList";
import { handleAxiosCall } from "server/helpers/network";
import { UserAgentDetails } from "../base/models/userAgentDetails";
import { SearchRecipeResponse } from "../base/models/recipe";

export interface RecipeListSuggestions {
  suggestedRecipeCategories: RecipeList[];
}

export interface PaginatedRecipeListSuggestions {
  suggestedRecipeCategories: RecipeList[];
  nextPageKey?: number;
}

export default class RecoEngineApi {
  httpClient = axios.create({
    baseURL: ConfigProvider.RECO_API_BASE_PATH,
  });

  async suggestRecipeLists(
    heroImageKey: string,
    userAgentPromise: Promise<UserAgentDetails | null>
  ): Promise<RecipeListSuggestions> {
    return (
      await handleAxiosCall<RecipeListSuggestions>(
        async () =>
          await this.httpClient.post("/suggestRecipeCategories", {
            fileKeys: { hero: heroImageKey },
            userAgentDetails: await userAgentPromise,
          })
      )
    ).data;
  }

  async suggestRecipeListsPaginated(
    heroImageKey: string,
    userAgentPromise: Promise<UserAgentDetails | null>,
    pageKey?: number
  ): Promise<PaginatedRecipeListSuggestions> {
    return (
      await handleAxiosCall<PaginatedRecipeListSuggestions>(
        async () =>
          await this.httpClient.post("/suggestRecipeCategoriesv2", {
            fileKeys: { hero: heroImageKey },
            pageKey,
            userAgentDetails: await userAgentPromise,
          })
      )
    ).data;
  }

  identifyProduct = async (query: any, body: any): Promise<any> =>
    (
      await handleAxiosCall(
        async () => await this.httpClient.post("/identify-product", body)
      )
    ).data;

  createDescriptions = async (query: any, body: any): Promise<any> =>
    (
      await handleAxiosCall(
        async () => await this.httpClient.post("/descriptions", body)
      )
    ).data;

  getDescriptions = async (query: any, body: any): Promise<any> => {
    const { id } = query as { id: string };
    return (
      await handleAxiosCall(
        async () => await this.httpClient.get("/descriptions/" + id)
      )
    ).data;
  };

  generateMoreDescriptions = async (query: any, body: any): Promise<any> => {
    const { id } = query as { id: string };
    return (
      await handleAxiosCall(
        async () =>
          await this.httpClient.post(`/descriptions/${id}/generate`, body)
      )
    ).data;
  };

  async searchRecipes(
    query: unknown,
    body: unknown
  ): Promise<SearchRecipeResponse> {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post(`/searchRecipes`, body)
      )
    ).data as SearchRecipeResponse;
  }
}
