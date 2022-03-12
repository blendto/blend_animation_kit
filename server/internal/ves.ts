import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { handleAxiosCall } from "server/helpers/network";
import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import { Recipe } from "server/base/models/recipe";

const VES_SERVICE_BASE_URL = ConfigProvider.VES_API_BASE_PATH;

export interface PreviewRequestParams {
  recipeId: string;
  variant: string;
  fileKeys: {
    original: string;
    withoutBg: string;
  };
}

export enum PreviewRequestSchema {
  recipe = "RECIPE",
  blend = "BLEND",
}

export interface SavePreviewRequest {
  body: Recipe;
  schema: PreviewRequestSchema;
  uploadDetails: PresignedPost;
}

export default class VesApi {
  httpClient = axios.create({
    baseURL: VES_SERVICE_BASE_URL,
  });

  preview = async (params: PreviewRequestParams) => {
    return await handleAxiosCall(async () => {
      return (
        await this.httpClient.post("/preview", params, {
          responseType: "stream",
        })
      ).data;
    });
  };

  async savePreview(params: SavePreviewRequest) {
    return await handleAxiosCall(async () => {
      return (await this.httpClient.post("/savePreview", params)).data;
    });
  }
}
