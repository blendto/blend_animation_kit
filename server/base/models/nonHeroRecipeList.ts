interface Translation {
  keywords: string[];
  language: string;
  searchTerms: string[];
  title: string;
}

export interface NonHeroRecipeList {
  id: string;
  isEnabled: number;
  title: string;
  recipes: RecipeVariantId[];
  areRecipesRandomizable: boolean;
  filters: Record<any, any>;
  translation: Translation[];
  sortOrder?: number;
}

export enum RecipeSource {
  DEFAULT = "DEFAULT",
  BRANDING = "BRANDING",
}

export interface RecipeVariantId {
  id: string;
  variant: string;
  extra?: { title?: string; thumbnail?: string; isPremium?: boolean };
  source?: RecipeSource;
}
