import { inject, injectable } from "inversify";
import { IService } from "./index";
import { TYPES } from "../types";
import { Repo } from "../repositories/base";
import { NonHeroRecipeListEntity } from "../repositories/nonHeroRecipeList";
import { EncodedPageKey } from "../helpers/paginationUtils";
import UserError from "../base/errors/UserError";
import { RecipeVariantId, Translation } from "../base/models/nonHeroRecipeList";
import { diContainer } from "../../inversify.config";
import { BlendService } from "./blend";
import { FlowType } from "../base/models/recipe";
import { UserService } from "./user";
import { RecipeService } from "./recipe";
import ConfigProvider from "../base/ConfigProvider";
import { DaxDB } from "../external/dax";
import logger from "../base/Logger";
import IpApi from "../external/ipapi";

type NonHeroRecipeListPage = {
  recipeLists: NonHeroRecipeListEntity[];
  nextPageKey: string;
};
const PAGE_SIZE = 10;

@injectable()
export class NonHeroRecipeListService implements IService {
  @inject(TYPES.DaxDB) daxStore: DaxDB;
  @inject(TYPES.NonHeroRecipeListRepo) repo: Repo<NonHeroRecipeListEntity>;
  ipApi = new IpApi();

  async getRecipeListPage(pageKey: string): Promise<NonHeroRecipeListPage> {
    const encodedPageKey = new EncodedPageKey(pageKey);
    if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
      throw new UserError("pageKey should be a string");
    }
    const pageKeyObject = encodedPageKey.decode();

    const data = await this.repo.query(
      { isEnabled: 1 },
      { limit: PAGE_SIZE, sort: "ascending", startAt: pageKeyObject }
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const nextPageKey = EncodedPageKey.fromObject(data.lastKey)?.key;
    return { recipeLists: data, nextPageKey };
  }

  async addRecipeDetailsInList(
    recipeList: NonHeroRecipeListEntity
  ): Promise<NonHeroRecipeListEntity> {
    const recipeKeysTemp = recipeList.recipes.map((recipe) => ({
      id: recipe.id,
      variant: recipe.variant,
    }));

    // in case there are duplicate keys, remove those
    const recipeKeys = recipeKeysTemp.filter(
      (value, index, self) =>
        index ===
        self.findIndex((t) => t.id === value.id && t.variant === value.variant)
    );
    if (recipeKeys.length !== recipeKeysTemp.length) {
      logger.warn(
        `Duplicates found in recipe keys: ${JSON.stringify(recipeKeysTemp)}`
      );
    }
    const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
    const recipeDetailsList = await recipeService.getRecipes(
      recipeKeys,
      "id, variant, thumbnail, recipeDetails.isPremium"
    );
    recipeList.recipes = recipeList.recipes.map((recipe) => ({
      ...recipe,
      extra: (({ thumbnail, recipeDetails }) => ({
        thumbnail,
        isPremium: recipeDetails?.isPremium,
      }))({
        ...recipeDetailsList.find(
          (recipeDetail) =>
            recipe.id === recipeDetail.id &&
            recipe.variant === recipeDetail.variant
        ),
      }),
    }));
    return recipeList;
  }

  async getCountryCodeFromIP(ip: string) {
    if (ip) {
      try {
        const ipDetails = (await this.ipApi.getIpInfo(ip)) as Record<
          string,
          string
        >;
        const countryCode = ipDetails.country_code;
        return countryCode;
      } catch (err) {
        logger.error(err);
        return null;
      }
    }
    return null;
  }

  async getAll(
    pageKey: string,
    uid: string,
    ip: string
  ): Promise<NonHeroRecipeListPage> {
    const recipeListsPage: NonHeroRecipeListPage = {
      recipeLists: [],
      nextPageKey: pageKey,
    };
    let fetched: NonHeroRecipeListPage;
    const countryCode = await this.getCountryCodeFromIP(ip);
    do {
      // eslint-disable-next-line no-await-in-loop
      fetched = await this.getRecipeListPage(recipeListsPage.nextPageKey);
      // filter the page result based on IP
      if (countryCode) {
        fetched.recipeLists = fetched.recipeLists.filter(
          (recList) =>
            recList.filters.countryCodes.length === 0 ||
            recList.filters.countryCodes.includes(countryCode)
        );
      } else {
        fetched.recipeLists = fetched.recipeLists.filter(
          (recList) => recList.filters.countryCodes.length === 0
        );
      }
      recipeListsPage.recipeLists.push(...fetched.recipeLists);
      recipeListsPage.nextPageKey = fetched.nextPageKey;
    } while (
      recipeListsPage.recipeLists.length < PAGE_SIZE &&
      fetched.nextPageKey
    );

    const recipeListsWithDetails = await Promise.all(
      recipeListsPage.recipeLists.map(
        async (recipeList) => await this.addRecipeDetailsInList(recipeList)
      )
    );

    if (!pageKey) {
      const blendService = diContainer.get<BlendService>(TYPES.BlendService);
      const recentRecipes = (
        await blendService.getRecentRecipes(uid, FlowType.START_WITH_A_TEMPLATE)
      ).slice(0, 5);
      const recentRecipesWithDetails =
        // we only care about recipes field being filled in,
        // so we provide empty values for other fields
        (
          await this.addRecipeDetailsInList({
            recipes: recentRecipes.map((rec) => ({
              id: rec.id,
              variant: rec.variant,
            })),
            title: "",
            filters: null,
            translation: [],
            id: "",
            isEnabled: 1,
            sortOrder: 0,
          })
        ).recipes;
      const userService = diContainer.get<UserService>(TYPES.UserService);
      const favouriteRecipes = (
        await userService.getOrCreate(uid)
      ).favouriteRecipes
        .filter(
          (favRec) =>
            !!favRec.fullRecipe.extra.applicableFor?.includes(
              FlowType.START_WITH_A_TEMPLATE
            )
        )
        .map((favRecipe) => favRecipe.fullRecipe);
      recipeListsWithDetails.unshift(
        await this.fillRecentsAndFavsRecipeList([
          ...recentRecipesWithDetails,
          ...favouriteRecipes,
        ])
      );
    }
    recipeListsPage.recipeLists = recipeListsWithDetails;
    return recipeListsPage;
  }

  async fillRecentsAndFavsRecipeList(
    recipes: RecipeVariantId[]
  ): Promise<NonHeroRecipeListEntity> {
    const { data } = (await this.daxStore.getItem({
      TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
      Key: { key: "recents-and-fav-translations", version: "1" },
    })) as { data: { translation: Translation[] } };
    const recentsAndFavsRecipeList: NonHeroRecipeListEntity = {
      filters: undefined,
      id: "recents-and-favourites",
      isEnabled: 1,
      recipes,
      title: "Recents and favourites",
      translation: data.translation,
      sortOrder: 0,
    };
    return recentsAndFavsRecipeList;
  }
}
