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

  constructor(recipeId: string, variant: string) {
    this.recipeId = recipeId;
    this.variant = variant;
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
  new SelectRecipeOperation("bday-temp-1", "1:1");
