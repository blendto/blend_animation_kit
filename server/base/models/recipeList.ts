export interface RecipeList {
  id: string;
  isEnabled: boolean;
  title: string;
  recipeIds: string[];
  recipes: RecipeVariantId[];
  sortOrder?: number;
}

export interface RecipeVariantId {
  id: string;
  variant: string;
}
