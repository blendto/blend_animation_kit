import "reflect-metadata";
import {
  RecipeList,
  RecipeSource,
  RecipeVariantId,
  SavedRecipeSuggestions,
} from "server/base/models/recipeList";
import { BlendService } from "server/service/blend";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import { UserError } from "server/base/errors";
import RecoEngineApi, { StyleSuggestions } from "server/internal/reco-engine";
import { FlowType, Recipe } from "server/base/models/recipe";
import { ImageFileKeys } from "server/base/models/heroImage";
import { UserService } from "server/service/user";
import ConfigProvider from "server/base/ConfigProvider";
import { DaxDB } from "server/external/dax";
import BrandingService from "./branding";

@injectable()
export class SuggestionService {
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.UserService) userService: UserService;
  @inject(TYPES.BrandingService) brandingService: BrandingService;
  @inject(TYPES.DaxDB) daxStore: DaxDB;
  recoEngineApi = new RecoEngineApi();

  async selectFileKeysFromBatchPreview(
    uid: string,
    batchId: string
  ): Promise<ImageFileKeys> {
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
    return (
      await this.suggestRecipes(
        uid,
        heroImages.withoutBg,
        ip,
        FlowType.BATCH
      )
    ).recipeLists;
  }

  /**
   * @deprecated Use `suggestRecipesPaginated`
   */
  async suggestRecipes(
    uid: string,
    fileKey: string,
    ip: string,
    flow: FlowType
  ): Promise<{ recipeLists: RecipeList[]; randomTemplates: string[] }> {
    let recipeLists = (
      await this.recoEngineApi.suggestRecipeLists(
        fileKey,
        this.userService.getUserAgent(ip),
        flow
      )
    ).suggestedRecipeCategories;

    recipeLists.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    );

    if (uid) {
      recipeLists = await this.blendService.addRecentsToRecipeLists(
        uid,
        recipeLists
      );
    }

    // For backward compatibility, use recipes to fill 9:16 ones in recipeIds
    recipeLists.forEach((list) => {
      list.recipeIds = list.recipes
        // eslint-disable-next-line eqeqeq
        .filter(({ variant }) => variant == "9:16")
        .map(({ id }) => id);
    });

    // For Backwards compatibility
    const randomTemplates = [];

    return { recipeLists, randomTemplates };
  }

  async suggestRecipesPaginated(
    requestBody: SuggestRecipePaginatedRequestBody
  ): Promise<{ recipeLists: RecipeList[]; nextPageKey?: number }> {
    const { uid, fileKey, ip, pageKey, productSuperCategory, filters, flow } =
      requestBody;
    const suggestions = await this.recoEngineApi.suggestRecipeListsPaginated({
      heroImageKey: fileKey,
      userAgentPromise: this.userService.getUserAgent(ip),
      pageKey,
      productSuperCategory,
      filters,
      flow,
    });

    let recipeLists = suggestions.suggestedRecipeCategories;

    recipeLists.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    );

    if (!pageKey) {
      recipeLists = await this.blendService.addRecentsToRecipeLists(
        uid,
        recipeLists
      );
      recipeLists = await this.brandingService.addToRecipeLists(
        uid,
        recipeLists
      );
    }

    return { recipeLists, nextPageKey: suggestions.nextPageKey };
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

  async suggestStyles(fileKey: string, ip: string): Promise<StyleSuggestions> {
    const suggestions = await this.recoEngineApi.suggestStyles(
      fileKey,
      this.userService.getUserAgent(ip)
    );
    suggestions.styleSuggestions = suggestions.styleSuggestions.map((s) => ({
      colorPalette: s.colorPalette,
    }));
    return suggestions;
  }

  async recipeListMapper(list: RecipeList): Promise<RecipeList> {
    const promises = list.recipes.map((recipe) => {
      if (recipe.source === RecipeSource.BRANDING) {
        return recipe;
      }
      return this.backfillRecipeDetails(recipe);
    });
    list.recipes = await Promise.all(promises);
    return list;
  }

  async backfillRecipeDetails(
    recipeVariantId: RecipeVariantId,
    source = RecipeSource.DEFAULT
  ): Promise<RecipeVariantId> {
    const { id, variant } = recipeVariantId;
    const recipe =
      source === RecipeSource.DEFAULT
        ? ((await this.daxStore.getItem({
            TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
            Key: { id, variant },
          })) as Recipe)
        : await this.brandingService.getRecipeOrFail(id, variant);

    const { title, thumbnail } = recipe;
    recipeVariantId.source = source;
    recipeVariantId.extra = {
      title,
      thumbnail,
      isPremium: recipe.recipeDetails.isPremium,
    };

    return recipeVariantId;
  }
}

interface SuggestRecipePaginatedRequestBody {
  uid: string;
  fileKey: string;
  ip: string;
  pageKey?: number;
  productSuperCategory?: string;
  filters?: Record<string, unknown>;
  flow: FlowType;
}
