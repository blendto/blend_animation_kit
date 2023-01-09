import { FlowType } from "./recipe";

export interface RecipeList {
  id: string;
  isEnabled: boolean;
  title: string;
  recipeIds: string[];
  recipes: RecipeVariantId[];
  sortOrder?: number;
  uiConfig?: RecipeListUIConfig;
}

export interface RecipeListUIConfig {
  showRecipeTitles: boolean;
  showCategoryTitle: boolean;
  showRecipeVariants?: boolean;
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

export interface SavedRecipeSuggestions {
  countrySpecific: Record<string, RecipeList[]>;
  common: RecipeList[];
}

type IdVariant = { id: string; variant?: string };

export function recipeIdStr(idVariant: IdVariant): string {
  return `${idVariant.id}/${idVariant.variant}`;
}
