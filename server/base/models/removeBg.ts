import { Rect } from "server/helpers/rect";

export interface ToolkitErrorResponse {
  code?: string;
  message: string;
}

export interface BgRemovedFileKeys {
  original: string;
  withoutBg: string;
}

export enum RemoveBGSource {
  BLEND = "BLEND",
  BRANDING = "BRANDING",
}

export interface RemoveBGCommandMetadata {
  source: RemoveBGSource;
  fileKeys: BgRemovedFileKeys;
}

export interface BgRemovalMetadata {
  predictedClass: string;
  primaryClass: string;
  segmentationProvider: string;
  qualityConfidence: string;
  cropBoundaries?: Rect;
}

export class ClassificationMetadata {
  productSuperClass: string;
  userChosenSuperClass?: string;

  isAiStudioQualified: boolean;

  public get superClass(): string {
    return this.userChosenSuperClass ?? this.productSuperClass;
  }
}

export interface BgRemovalRetriggerCheckResponse {
  updatedSuperClass: string;
  predictedSuperClass: string;
  isRetriggerRequired: boolean;
}
