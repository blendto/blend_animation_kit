import { RecipeVariantId } from "server/base/models/recipeList";

export enum BatchState {
  INITIALIZED = "INITIALIZED",
  DELETED = "DELETED",
}

export type BatchItemExport = {
  blendId: string;
  output?: unknown;
};

export class BatchBlend {
  blendId: string;
  index: number;
}

export class Batch {
  id: string;
  baseRecipe: RecipeVariantId;
  status: BatchState;
  blends: BatchBlend[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  outputs: Record<string, BatchItemExport>;
}
