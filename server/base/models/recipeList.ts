export interface RecipeList {
  id: String;
  isEnabled: boolean;
  title: String;
  recipeIds: String[];
  sortOrder?: number;
}
