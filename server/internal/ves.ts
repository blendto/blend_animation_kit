import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import axios, { AxiosInstance } from "axios";

import ConfigProvider from "server/base/ConfigProvider";
import { Recipe, TextUpdate } from "server/base/models/recipe";
import {
  axiosRetryCondition as retryCondition,
  handleAxiosCall,
} from "server/helpers/network";
import axiosRetry from "axios-retry";
import { Blend } from "server/base/models/blend";
import { IncomingMessage } from "node:http";

const VES_SERVICE_BASE_URL = ConfigProvider.VES_API_BASE_PATH;

export interface PreviewRequestParams {
  recipeId: string;
  variant: string;
  fileKeys: {
    original: string;
    withoutBg: string;
  };
}

export interface PreviewRequestParamsV2 {
  body: Recipe;
  schema: "RECIPE" | "BLEND";
}

export enum ExportRequestSchema {
  Recipe = "RECIPE",
  Blend = "BLEND",
}

export interface SaveExportRequest {
  body: Recipe;
  schema: ExportRequestSchema;
}

export interface SuppliedFFmpegDependencies {
  duration: number;
  files: Record<string, string>;
  outputPaths: Record<string, string>;
}

export interface GenerateFFmpegCommandRequest {
  blend: Blend;
  dependencies: SuppliedFFmpegDependencies;
}

export interface SavePreviewRequest extends SaveExportRequest {
  uploadDetails: PresignedPost;
}

export interface SaveThumbnailRequest {
  inputs: { url: string }[];
  count: string;
  uploadDetails: PresignedPost;
}

export interface FitTextResponse {
  textUpdates: TextUpdate[];
}

export default class VesApi {
  httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: VES_SERVICE_BASE_URL,
    });

    axiosRetry(this.httpClient, { retries: 3, retryCondition });
  }

  preview = async (params: PreviewRequestParams) =>
    (
      await handleAxiosCall(
        async () =>
          await this.httpClient.post("/preview", params, {
            responseType: "stream",
          })
      )
    ).data as IncomingMessage;

  previewV2 = async (params: PreviewRequestParamsV2) =>
    (
      await handleAxiosCall(
        async () =>
          await this.httpClient.post("/preview-v2", params, {
            responseType: "stream",
          }),
        "warn" // This sometimes fails coz of scaling delays, lets not log it as an error
      )
    ).data as IncomingMessage;

  fitText = async (params: PreviewRequestParamsV2) =>
    (
      await handleAxiosCall(
        async () => await this.httpClient.post("/fit-text", params)
      )
    ).data as FitTextResponse;

  async savePreview(params: SavePreviewRequest) {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post("/savePreview", params)
      )
    ).data as Record<string, string>;
  }

  async generateBatchThumbnail(params: SaveThumbnailRequest) {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post("/saveStackedImages", params)
      )
    ).data as Record<string, string>;
  }

  async saveExport(params: SaveExportRequest): Promise<object> {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post("/saveExport", params)
      )
    ).data as object;
  }

  async generateFFmpegCommands(
    params: GenerateFFmpegCommandRequest
  ): Promise<Record<string, string>> {
    return (
      await handleAxiosCall(
        async () =>
          await this.httpClient.post("/generateFFmpegExportCommand", params)
      )
    ).data as Record<string, string>;
  }
}
