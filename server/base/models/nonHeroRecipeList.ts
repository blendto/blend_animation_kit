import { FlowType } from "./recipe";

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

export enum RecipeSource {
  DEFAULT = "DEFAULT",
  BRANDING = "BRANDING",
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
