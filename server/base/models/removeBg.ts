export interface ToolkitErrorResponse {
  code?: string;
  message: string;
}

export interface ImageFileKeys {
  original: string;
  withoutBg: string;
}

export enum RemoveBGSource {
  BLEND = "BLEND",
}

export interface RemoveBGCommandMetadata {
  source: RemoveBGSource;
  fileKeys: ImageFileKeys;
}
