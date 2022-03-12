import {
  BatchOperation,
  SelectRecipeOperation,
} from "server/base/models/batchOperations";
import { ElementSource, Recipe } from "server/base/models/recipe";
import { diContainer } from "inversify.config";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";
import { Blend } from "server/base/models/blend";
import { Batch } from "server/base/models/batch";

export default class BatchRecipeProcessor {
  selectRecipeOperation: SelectRecipeOperation;
  recipeEditOperations: BatchOperation[];
  blend: Blend;

  constructor(batch: Batch, blend: Blend) {
    const [head, ...others] = batch.operations;
    this.selectRecipeOperation = head as SelectRecipeOperation;
    this.recipeEditOperations = others;
    this.blend = blend;
  }

  async generateRecipe(): Promise<Recipe> {
    const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);

    let recipe = await recipeService.getRecipe(
      this.selectRecipeOperation.recipeId,
      this.selectRecipeOperation.variant
    );

    // TODO: move this method to Recipe
    this.replaceHero(recipe);

    return this.addInteractionsToRecipe(recipe);
  }

  // noinspection JSMethodCanBeStatic
  private async addInteractionsToRecipe(recipe: Recipe): Promise<Recipe> {
    // TODO: Add interactions from other operations
    return recipe;
  }

  private replaceHero(recipe: Recipe) {
    const heroUid = recipe.recipeDetails?.elements?.hero?.uid;
    if (!heroUid) {
      return;
    }
    recipe.images?.forEach((image) => {
      if (image.uid === heroUid) {
        image.source = ElementSource.blend;
        image.uri = this.blend.heroImages.withoutBg;
      }
    });
  }
}
