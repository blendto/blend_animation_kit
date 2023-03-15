import { ElementSource, Recipe } from "server/base/models/recipe";
import { diContainer } from "inversify.config";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";
import BrandingService from "server/service/branding";
import ConfigProvider from "server/base/ConfigProvider";
import { RecipeSource } from "server/base/models/recipeList";

export abstract class RecipeSourceHandler {
  abstract getRecipe(
    uid: string,
    recipeId: string,
    variant: string
  ): Promise<Recipe>;
  abstract getElementSource(): ElementSource;
  abstract isPremium(recipe: Recipe): boolean;
  abstract getStorageBucket(): string;

  static from(source: RecipeSource): RecipeSourceHandler {
    return source === RecipeSource.DEFAULT
      ? new DefaultRecipeSourceHandler()
      : new BrandingRecipeSourceHandler();
  }
}

export class DefaultRecipeSourceHandler implements RecipeSourceHandler {
  async getRecipe(
    uid: string,
    recipeId: string,
    variant: string
  ): Promise<Recipe> {
    const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
    return await recipeService.getRecipeOrFail(recipeId, variant);
  }

  getElementSource(): ElementSource {
    return ElementSource.recipe;
  }

  isPremium(recipe: Recipe): boolean {
    return recipe.recipeDetails.isPremium;
  }

  getStorageBucket(): string {
    return ConfigProvider.RECIPE_INGREDIENTS_BUCKET;
  }
}

export class BrandingRecipeSourceHandler implements RecipeSourceHandler {
  async getRecipe(
    uid: string,
    recipeId: string,
    variant: string
  ): Promise<Recipe> {
    const brandingService = diContainer.get<BrandingService>(
      TYPES.BrandingService
    );
    return await brandingService.useRecipe(uid, recipeId, variant);
  }

  getElementSource(): ElementSource {
    return ElementSource.branding;
  }

  isPremium(): boolean {
    return true;
  }

  getStorageBucket(): string {
    return ConfigProvider.BRANDING_BUCKET;
  }
}
