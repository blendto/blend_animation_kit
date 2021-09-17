import { Recipe, Size } from "./recipe";

export type BlendStatus = "INITIALIZED" | "SUBMITTED" | "GENERATED" | "DELETED";

export interface Blend extends Recipe {
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
