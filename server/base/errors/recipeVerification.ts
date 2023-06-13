import { Recipe } from "../models/recipe";

// Version 2.4 Introduces Elements API which is not supported in 2.3 and below
export const checkCompatibilityWithElements = (
  recipe: Recipe,
  targetEncoder: number
): boolean => {
  if (targetEncoder < 2.4 && recipe.metadata?.source?.version >= 2.4) {
    return !recipe.externalImages.some((image) => image.source === "ELEMENT");
  }
  return true;
};
