import { Recipe, RecipeWrapper } from "server/base/models/recipe";

export class ExportPrepAgent {
  recipe: Recipe;

  constructor(recipe: Recipe) {
    this.recipe = recipe;
  }

  prepareForVes(shouldWatermark: boolean): Recipe {
    if (shouldWatermark) {
      new RecipeWrapper(this.recipe).addWatermark();
    }
    return this.recipe;
  }
}
