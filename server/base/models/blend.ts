import { Recipe, Size } from "./recipe";
import { HeroImageFileKeys } from "./heroImage";

export enum BlendStatus {
  Initialized = "INITIALIZED",
  Submitted = "SUBMITTED",
  Generated = "GENERATED",
  Deleted = "DELETED",
}

export enum BlendVersion {
  current = "CURRENT",
  generated = "GENERATED",
}

export enum BatchLevelEditStatus {
  INDIVIDUALLY_EDITED = "INDIVIDUALLY_EDITED",
  RECIPE_EDITED = "RECIPE_EDITED",
}

export interface Blend extends Recipe {
  id: string;
  version: BlendVersion;
  batchId?: string;
  filePath?: string;
  imagePath?: string;
  thumbnail?: string;
  output?: BlendOutput;
  status: BlendStatus;
  createdBy: string;
  createdAt: number;
  createdOn: string;
  updatedAt: number;
  updatedOn: string;
  heroImages?: HeroImageFileKeys;
  statusUpdates: BlendStatusUpdate[];
  expireAt?: number;
  batchLevelEditStatus?: BatchLevelEditStatus;
}

export interface BlendStatusUpdate {
  status: BlendStatus;
  on: number;
  creditServiceActivityLogId?: string;
}

export interface BlendOutput {
  video: OutputDescriptor;
  image: OutputDescriptor;
  thumbnail: OutputDescriptor;
}

export interface OutputDescriptor {
  path: string;
  resolution: Size;
}

export class BlendModelUtils {
  static getBlendIdFromFileKey(fileKey: string) {
    const names = fileKey.split("/");
    return names.length === 2 ? names[0] : null;
  }
}
