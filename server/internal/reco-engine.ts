/*
  eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-return,
  @typescript-eslint/restrict-template-expressions
*/
import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { RecipeList } from "server/base/models/recipeList";
import { handleAxiosCall } from "server/helpers/network";
import { UserAgentDetails } from "../base/models/userAgentDetails";

export interface RecipeListSuggestions {
  suggestedRecipeCategories: RecipeList[];
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
      await handleAxiosCall<RecipeListSuggestions>(async () =>
        this.httpClient.post("/suggestRecipeCategories", {
          fileKeys: { hero: heroImageKey },
          userAgentDetails: await userAgentPromise,
        })
      )
    ).data;
  }

  identifyProduct = async (query: any, body: any): Promise<any> =>
    (
      await handleAxiosCall<any>(async () =>
        this.httpClient.post("/identify-product", body)
      )
    ).data;

  createDescriptions = async (query: any, body: any): Promise<any> =>
    (
      await handleAxiosCall<any>(async () =>
        this.httpClient.post("/descriptions", body)
      )
    ).data;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDescriptions = async (query: any, body: any): Promise<any> =>
    (
      await handleAxiosCall<any>(async () =>
        this.httpClient.get(`/descriptions/${query.id}`)
      )
    ).data;

  generateMoreDescriptions = async (query: any, body: any): Promise<any> =>
    (
      await handleAxiosCall<any>(async () =>
        this.httpClient.post(`/descriptions/${query.id}/generate`, body)
      )
    ).data;
}
