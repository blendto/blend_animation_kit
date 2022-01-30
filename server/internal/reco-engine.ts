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
    userAgentDetails: UserAgentDetails | null
  ): Promise<RecipeListSuggestions> {
    return (
      await handleAxiosCall<RecipeListSuggestions>(async () => {
        return await this.httpClient.post("/suggestRecipeCategories", {
          fileKeys: { hero: heroImageKey },
          userAgentDetails: userAgentDetails,
        });
      })
    ).data;
  }

  identifyProduct = async (query: any, body: any): Promise<any> => {
    return (
      await handleAxiosCall<any>(async () => {
        return await this.httpClient.post("/identify-product", body);
      })
    ).data;
  };

  createDescriptions = async (query: any, body: any): Promise<any> => {
    return (
      await handleAxiosCall<any>(async () => {
        return await this.httpClient.post("/descriptions", body);
      })
    ).data;
  };

  getDescriptions = async (query: any, body: any): Promise<any> => {
    return (
      await handleAxiosCall<any>(async () => {
        return await this.httpClient.get("/descriptions/" + query.id);
      })
    ).data;
  };

  generateMoreDescriptions = async (query: any, body: any): Promise<any> => {
    return (
      await handleAxiosCall<any>(async () => {
        return await this.httpClient.post(
          `/descriptions/${query.id}/generate`,
          body
        );
      })
    ).data;
  };
}
