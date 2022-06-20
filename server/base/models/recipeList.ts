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
  extra?: { title?: string; thumbnail?: string; isPremium?: boolean };
}

export interface SavedRecipeSuggestions {
  countrySpecific: Record<string, RecipeList[]>;
  common: RecipeList[];
}
