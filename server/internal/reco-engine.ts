import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { RecipeList } from "server/base/models/recipeList";
import { handleAxiosCall } from "server/helpers/network";
import { UserAgentDetails } from "server/base/models/userAgentDetails";
import { SearchRecipeResponse, FlowType } from "server/base/models/recipe";
import { DetectProductCategoryResponse } from "server/base/models/recoEngine";
import {
  ClassificationMetadata,
  BgRemovedFileKeys,
} from "server/base/models/removeBg";
import { instanceToPlain, plainToClass } from "class-transformer";

export interface RecipeListSuggestions {
  suggestedRecipeCategories: RecipeList[];
}

export interface PaginatedRecipeListSuggestions {
  suggestedRecipeCategories: RecipeList[];
  nextPageKey?: number;
}

export interface StyleSuggestions {
  styleSuggestions: {
    colorPalette: {
      colors: string[];
      contrastingColors: { indices: [string, string]; delta: number }[];
      similarColors: { indices: [string, string]; delta: number }[];
    };
  }[];
}

export default class RecoEngineApi {
  httpClient = axios.create({
    baseURL: ConfigProvider.RECO_API_BASE_PATH,
  });

  constructor() {
    this.httpClient.interceptors.request.use((req) => {
      req.data = instanceToPlain(req.data);
      return req;
    });
  }

  private dedicatedClassToSuperClassMapping: Record<string, string> = {
    vechicles: "automobile",
    bikes: "automobile",
    bags: "bag",
    beverages: "beverage",
    clothes_on_flat_surfaces: "clothing",
    clothing_on_hanger: "clothing",
    clothing_on_mannequin: "clothing",
    lingerie: "clothing",
    personal_care: "cosmetics",
    mobile_phone: "electronics",
    mobile_phone_accessories: "electronics",
    electronics: "electronics",
    hardware: "electronics",
    eyewear: "eyewear",
    accessories: "fashion_accessories",
    caps: "fashion_accessories",
    socks: "fashion_accessories",
    food: "food",
    food_bowl: "food",
    plated_food: "food",
    packaged_food_products: "food",
    gift_bouquet: "furnishing",
    books: "furnishing",
    décor: "furnishing",
    furniture: "furnishing",
    graphic: "graphics",
    jewellery: "jewellery",
    pet_supplies: "others",
    toys: "others",
    musical_instruments: "others",
    plants: "others",
    outdoor: "others",
    kitchen: "others",
    portrait: "person",
    above_waist_portrait: "person",
    profile_pic: "person",
    group_of_people: "person",
    shoes: "shoes",
  };

  async suggestRecipeLists(
    heroImageKey: string,
    userAgentPromise: Promise<UserAgentDetails | null>,
    flow: FlowType
  ): Promise<RecipeListSuggestions> {
    return (
      await handleAxiosCall<RecipeListSuggestions>(
        async () =>
          await this.httpClient.post("/suggestRecipeCategories", {
            fileKeys: { hero: heroImageKey },
            userAgentDetails: await userAgentPromise,
            flow,
          })
      )
    ).data;
  }

  async suggestRecipeListsPaginated(requestBody: {
    heroImageKey: string;
    userAgentPromise: Promise<UserAgentDetails | null>;
    pageKey?: number;
    productSuperCategory?: string;
    filters?: Record<string, unknown>;
    flow: FlowType;
  }): Promise<PaginatedRecipeListSuggestions> {
    const {
      heroImageKey,
      userAgentPromise,
      pageKey,
      productSuperCategory,
      filters,
      flow,
    } = requestBody;
    return (
      await handleAxiosCall<PaginatedRecipeListSuggestions>(
        async () =>
          await this.httpClient.post("/suggestRecipeCategoriesv2", {
            fileKeys: { hero: heroImageKey },
            pageKey,
            userAgentDetails: await userAgentPromise,
            productSuperCategory,
            filters,
            flow,
          })
      )
    ).data;
  }

  async suggestStyles(
    heroImageKey: string,
    userAgentPromise: Promise<UserAgentDetails | null>
  ): Promise<StyleSuggestions> {
    return (
      await handleAxiosCall<StyleSuggestions>(
        async () =>
          await this.httpClient.post("/suggestStyles", {
            fileKeys: { hero: heroImageKey },
            userAgentDetails: await userAgentPromise,
          })
      )
    ).data;
  }

  private getDedicatedClassToSuperClassMapping(className: string): string {
    return this.dedicatedClassToSuperClassMapping[className] ?? "others";
  }

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

  async detectProductCategory(
    fileKeys: BgRemovedFileKeys
  ): Promise<ClassificationMetadata> {
    const categoryResponse = (
      await handleAxiosCall(
        async () =>
          await this.httpClient.post(`/detectProductCategory`, {
            fileKeys,
          })
      )
    ).data as DetectProductCategoryResponse;

    const { detectedClass, isAiStudioQualified } = categoryResponse;
    const classificationMetadata = plainToClass(ClassificationMetadata, {
      productSuperClass:
        this.getDedicatedClassToSuperClassMapping(detectedClass),
      isAiStudioQualified,
    });

    return classificationMetadata;
  }
}
