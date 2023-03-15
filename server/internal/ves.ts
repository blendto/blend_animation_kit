import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import axios, { AxiosInstance } from "axios";

import ConfigProvider from "server/base/ConfigProvider";
import { Recipe } from "server/base/models/recipe";
import {
  axiosRetryCondition as retryCondition,
  handleAxiosCall,
} from "server/helpers/network";
import axiosRetry from "axios-retry";
import { Blend } from "server/base/models/blend";

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
    ).data;

  previewV2 = async (params: PreviewRequestParamsV2) =>
    (
      await handleAxiosCall(
        async () =>
          await this.httpClient.post("/preview-v2", params, {
            responseType: "stream",
          })
      )
    ).data;

  async savePreview(params: SavePreviewRequest) {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post("/savePreview", params)
      )
    ).data;
  }

  async generateBatchThumbnail(params: SaveThumbnailRequest) {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post("/saveStackedImages", params)
      )
    ).data;
  }

  async saveExport(params: SaveExportRequest) {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post("/saveExport", params)
      )
    ).data;
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
