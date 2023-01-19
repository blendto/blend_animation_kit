import { RecipeSource } from "./recipeList";

export enum BatchOperationType {
  select_recipe = "SELECT_RECIPE",
  individual_blend_edit = "INDIVIDUAL_BLEND_EDIT",
}

export interface BatchOperation {
  op: BatchOperationType;
}

export class SelectRecipeOperation implements BatchOperation {
  op: BatchOperationType = BatchOperationType.select_recipe;
  recipeId: string;
  variant: string;
  source: RecipeSource;

  constructor(
    recipeId: string,
    variant: string,
    source: RecipeSource = RecipeSource.DEFAULT
  ) {
    this.recipeId = recipeId;
    this.variant = variant;
    this.source = source;
  }
}

export class IndividualBlendEditOperation implements BatchOperation {
  op: BatchOperationType = BatchOperationType.individual_blend_edit;
  blendId: string;

  constructor(blendId: string) {
    this.blendId = blendId;
  }
}

export const DEFAULT_BATCH_OPERATION: BatchOperation =
  new SelectRecipeOperation("Solid0035", "1:1", RecipeSource.DEFAULT);
