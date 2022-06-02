import "reflect-metadata";
import {
  RecipeList,
  RecipeVariantId,
  SavedRecipeSuggestions,
} from "server/base/models/recipeList";
import { BlendService } from "server/service/blend";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import { UserError } from "server/base/errors";
import RecoEngineApi from "server/internal/reco-engine";
import { Recipe, RecipeUtils } from "server/base/models/recipe";
import uniqWith from "lodash/uniqWith";
import isEqual from "lodash/isEqual";
import take from "lodash/take";
import { HeroImageFileKeys } from "server/base/models/heroImage";
import { UserService } from "server/service/user";
import ConfigProvider from "server/base/ConfigProvider";
import { DaxDB } from "server/external/dax";

@injectable()
export class SuggestionService {
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.UserService) userService: UserService;
  @inject(TYPES.DaxDB) daxStore: DaxDB;
  recoEngineApi = new RecoEngineApi();

  async selectFileKeysFromBatchPreview(
    uid: string,
    batchId: string
  ): Promise<HeroImageFileKeys> {
    const blendIds = await this.blendService.getBlendIdsForBatch(batchId);
    const blendId = blendIds[0];
    if (!blendId) {
      throw new UserError(`No blends for batch ${batchId}`);
    }

    const blend = await this.blendService.getBlend(blendId);
    if (!blend.heroImages?.withoutBg) {
      throw new UserError(
        `Blend ${blendId} does not have bg-removed hero image`
      );
    }
    return blend.heroImages;
  }

  async suggestBatchRecipes(
    uid: string,
    batchId: string,
    ip: string
  ): Promise<RecipeList[]> {
    const heroImages = await this.selectFileKeysFromBatchPreview(uid, batchId);
    return (await this.suggestRecipes(uid, heroImages.withoutBg, ip))
      .recipeLists;
  }

  async suggestRecipes(
    uid: string,
    fileKey: string,
    ip: string,
    multipleAspectRatios?: boolean
  ): Promise<{ recipeLists: RecipeList[]; randomTemplates: string[] }> {
    let recipeLists = (
      await this.recoEngineApi.suggestRecipeLists(
        fileKey,
        this.userService.getUserAgent(ip)
      )
    ).suggestedRecipeCategories;

    recipeLists.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    );

    if (uid) {
      const recentBlends = await this.blendService.getRecentBlends(uid);
      let recentRecipes = recentBlends
        .filter(
          ({ metadata }) =>
            !!metadata.sourceRecipe ||
            (!!metadata.aspectRatio && !!metadata.sourceRecipeId)
        )
        .map(
          ({ metadata }) =>
            metadata.sourceRecipe ?? {
              id: metadata.sourceRecipeId,
              variant: RecipeUtils.aspectRatioToVariant(metadata.aspectRatio),
            }
        );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      recentRecipes = uniqWith(recentRecipes, isEqual);
      if (recentRecipes.length > 0) {
        recipeLists.unshift({
          id: "recents",
          isEnabled: true,
          title: "⏰ Recently Used",
          recipeIds: [],
          recipes: take(recentRecipes, 5),
          sortOrder: 0,
        });
      }
    }

    // For backward compatibility, use recipes to fill 9:16 ones in recipeIds
    recipeLists.forEach((list) => {
      list.recipeIds = list.recipes
        // eslint-disable-next-line eqeqeq
        .filter(({ variant }) => variant == "9:16")
        .map(({ id }) => id);
    });

    if (!multipleAspectRatios) {
      // If Multiple Aspect Ratios are not supported, backfill and filter out empty ones

      // For backward compatibility, use recipes to fill 9:16 ones in recipeIds
      recipeLists.forEach((list) => {
        list.recipeIds = list.recipes
          // eslint-disable-next-line eqeqeq
          .filter(({ variant }) => variant == "9:16")
          .map(({ id }) => id);
      });

      recipeLists = recipeLists.filter((list) => list.recipeIds.length > 0);
    }

    const randomTemplates = recipeLists
      .map((list) => list.recipeIds)
      .flat()
      .sort(() => 0.5 - Math.random())
      .slice(0, 20);

    return { recipeLists, randomTemplates };
  }

  async suggestHomePageRecipes(): Promise<RecipeList[]> {
    const { data: suggestions } = (await this.daxStore.getItem({
      TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
      Key: { key: "home_page_recipes", version: "1" },
    })) as { data: SavedRecipeSuggestions };

    const suggestionPromises = suggestions.common.map((list) =>
      this.recipeListMapper(list)
    );
    suggestions.common = await Promise.all(suggestionPromises);

    return suggestions.common;
  }

  private async recipeListMapper(list: RecipeList): Promise<RecipeList> {
    const promises = list.recipes.map((recipe) =>
      this.backfillRecipeDetails(recipe)
    );
    list.recipes = await Promise.all(promises);
    return list;
  }

  private async backfillRecipeDetails(
    recipeVariantId: RecipeVariantId
  ): Promise<RecipeVariantId> {
    const { id, variant } = recipeVariantId;

    const recipe = (await this.daxStore.getItem({
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      Key: { id, variant },
    })) as Recipe;

    const { title, thumbnail } = recipe;
    recipeVariantId.extra = { title, thumbnail };

    return recipeVariantId;
  }
}
