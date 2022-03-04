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
  statusUpdates: StatusUpdate[];
  expireAt?: number;
}

export interface StatusUpdate {
  status: BlendStatus;
  on: number;
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
