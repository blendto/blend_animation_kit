import { Entity } from "server/repositories/base";

export enum AnalyticsType {
  FEEDBACK = "FEEDBACK",
}

export enum AnalyticsSource {
  WEB = "WEB",
  MOBILE_APP = "MOBILE_APP",
}

export interface SaveAnalyticsRequest {
  dataType: AnalyticsType;
  source: AnalyticsSource;
  metadata: Record<string, unknown>;
}

export interface Analytics extends Entity {
  id: string;
  dataType: AnalyticsType;
  source: AnalyticsSource;
  createdBy: string;
  createdAt: number;
  createdOn: string;
  metadata: Record<string, unknown>;
}
