import { Recipe } from "./recipe";

export interface BrandingRecipe extends Recipe {
  brandingId: string;
  userId: string;
  lastUsedAt: number;
}
