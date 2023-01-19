import { FlowType } from "./recipe";
import { RecipeSource } from "./recipeList";

export interface Translation {
  language: string;
  searchTerms: string[];
  title: string;
}

interface Filters {
  countryCodes: string[];
}

export interface NonHeroRecipeList {
  id: string;
  isEnabled: number;
  title: string;
  recipes: RecipeVariantId[];
  filters: Filters;
  translation: Translation[];
  sortOrder?: number;
}

export interface RecipeVariantId {
  id: string;
  variant: string;
  extra?: {
    title?: string;
    thumbnail?: string;
    isPremium?: boolean;
    applicableFor?: FlowType[];
  };
  source?: RecipeSource;
}
