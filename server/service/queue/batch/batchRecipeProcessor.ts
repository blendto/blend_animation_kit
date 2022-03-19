import {
  BatchOperation,
  SelectRecipeOperation,
} from "server/base/models/batchOperations";
import { Recipe, RecipeWrapper } from "server/base/models/recipe";
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

    const recipe = await recipeService.getRecipe(
      this.selectRecipeOperation.recipeId,
      this.selectRecipeOperation.variant
    );

    const recipeWrapper = new RecipeWrapper(recipe);
    recipeWrapper.replaceHero(this.blend.heroImages.withoutBg);

    return this.addInteractionsToRecipe(recipe);
  }

  // noinspection JSMethodCanBeStatic
  private addInteractionsToRecipe(recipe: Recipe): Recipe {
    // TODO: Add interactions from other operations
    return recipe;
  }
}
