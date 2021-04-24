import { Recipe } from "./recipe";

export type BlendStatus = "INITIALIZED" | "SUBMITTED" | "GENERATED";

export interface Blend extends Recipe {
  filePath: String;
  imagePath: String;
  thumbnail: String;
  status: BlendStatus;
}
