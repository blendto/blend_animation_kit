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
}

export class ClassificationMetadata {
  productSuperClass: string;
  userChosenSuperClass?: string;

  public get superClass(): string {
    return this.userChosenSuperClass ?? this.productSuperClass;
  }
}

export interface BgRemovalRetriggerCheckResponse {
  updatedClass: string;
  predictedClass: string;
  isRetriggerRequired: boolean;
}
