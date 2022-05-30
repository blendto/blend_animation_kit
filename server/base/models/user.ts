import { Entity } from "server/repositories/base";

export interface SocialHandles {
  instagram?: string;
}

export interface ActivitySummary {
  posts: number;
  shoutoutsReceived: number;
}

export interface FavouriteRecipe {
  recipeId: string;
  recipeVariant: string;
}

export interface User extends Entity {
  id: string;
  stripeCustomerId?: string;
  name?: string;
  email?: string;
  phone?: string;
  socialHandles: SocialHandles;
  locale?: string;
  countryCode?: string;
  createdAt: number;
  updatedAt: number;
  profilePicture?: string;
  activitySummary: ActivitySummary;
  favouriteRecipes: FavouriteRecipe[];
}
