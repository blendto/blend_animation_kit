import { Recipe } from "./recipe";

export interface BrandingRecipe extends Recipe {
  userId: string;
  lastUsedAt: number;
}
