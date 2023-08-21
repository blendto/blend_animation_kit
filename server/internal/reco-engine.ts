import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { RecipeList } from "server/base/models/recipeList";
import { handleAxiosCall } from "server/helpers/network";
import { UserAgentDetails } from "server/base/models/userAgentDetails";
import { FlowType, SearchRecipeResponse } from "server/base/models/recipe";
import { DetectProductCategoryResponse } from "server/base/models/recoEngine";
import {
  BgRemovedFileKeys,
  ClassificationMetadata,
} from "server/base/models/removeBg";
import { instanceToPlain, plainToClass } from "class-transformer";
import { NextApiRequestExtended } from "../helpers/request";
import { ImageFileKeys } from "../base/models/heroImage";

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

export interface SearchRecipesClientRequestBody {
  fileKeys: ImageFileKeys;
  pageKey: number;
  parameters: {
    searchQuery: string;
  };
  flow: FlowType;
}

type SearchRecipesServerRequestBody = SearchRecipesClientRequestBody & {
  userAgentDetails: {
    countryCode: string;
  };
};

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

  private static dedicatedClassToSuperClassMappingV1: Record<string, string> = {
    vehicles: "automobile",
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
    decor: "furnishing",
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

  private static dedicatedClassToSuperClassMappingV2: Record<string, string> = {
    vehicles: "automobile",
    bikes: "automobile",
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
    bags: "fashion_accessories",
    accessories: "fashion_accessories",
    caps: "fashion_accessories",
    socks: "fashion_accessories",
    eyewear: "fashion_accessories",
    food: "food",
    food_bowl: "food",
    plated_food: "food",
    packaged_food_products: "food",
    furniture: "furniture",
    graphic: "graphics",
    jewellery: "jewellery",
    gift_bouquet: "others",
    books: "others",
    portrait: "person",
    above_waist_portrait: "person",
    profile_pic: "person",
    group_of_people: "person",
    shoes: "shoes",
    kitchen: "household",
    pet_supplies: "pets",
    toys: "toys",
    decor: "decor",
    plants: "decor",
    //   Only Used for migration
    furnishing: "furniture",
  };

  static v1ToV2ProductClassMigration(productClass: string) {
    if (
      Object.values(RecoEngineApi.dedicatedClassToSuperClassMappingV2).includes(
        productClass
      )
    ) {
      return productClass;
    }
    return (
      RecoEngineApi.dedicatedClassToSuperClassMappingV2[productClass] ??
      "others"
    );
  }

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
    entriesRequested?: number;
  }): Promise<PaginatedRecipeListSuggestions> {
    const {
      heroImageKey,
      userAgentPromise,
      pageKey,
      productSuperCategory,
      filters,
      flow,
      entriesRequested,
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
            entriesRequested,
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

  private static getDedicatedClassToSuperClassMapping(
    className: string,
    buildVersion: number
  ): string {
    if (buildVersion < 614) {
      return this.dedicatedClassToSuperClassMappingV1[className] ?? "others";
    }
    return this.dedicatedClassToSuperClassMappingV2[className] ?? "others";
  }

  async searchRecipes(
    body: SearchRecipesServerRequestBody
  ): Promise<SearchRecipeResponse> {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post(`/searchRecipes`, body)
      )
    ).data as SearchRecipeResponse;
  }

  async detectProductCategory(
    req: NextApiRequestExtended,
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

    const productSuperClass =
      RecoEngineApi.getDedicatedClassToSuperClassMapping(
        detectedClass,
        req.buildVersion
      );
    return plainToClass(ClassificationMetadata, {
      productSuperClass,
      isAiStudioQualified,
    });
  }
}
