export interface DetectProductCategoryResponse {
  detectedClass: string;
}

export enum SuggestFlowType {
  BATCH = "BATCH",
  ASSISTED_WEB = "ASSISTED_WEB",
  ASSISTED_MOBILE = "ASSISTED_MOBILE",
}
