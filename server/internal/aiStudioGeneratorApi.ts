import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { handleAxiosCall } from "server/helpers/network";
import ConfigProvider from "server/base/ConfigProvider";
import { GeneratedImage, SceneConfig } from "server/base/models/aistudio";

export interface AiStudioGenerateSamplesRequest {
  blendId: string;
  productSuperCategory: string;
  topicId?: string;
  promptId?: string;
  imagesToGenerate: number;
  requestIndex?: number;
  parameters?: {
    canvas: [number, number];
    position?: [number, number, number, number];
  };
  sourceGeneratedImageId?: string;
}

const { AI_STUDIO_BASE_URL } = ConfigProvider;
type GenerateSamplesResponse = { GeneratedImages: GeneratedImage[] };

export default class AiStudioGeneratorApi {
  httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({ baseURL: AI_STUDIO_BASE_URL });

    axiosRetry(this.httpClient, { retries: 3 });
  }

  async generateSamples(
    params: AiStudioGenerateSamplesRequest
  ): Promise<GeneratedImage[]> {
    return (
      (
        await handleAxiosCall(
          async () => await this.httpClient.post("/generate-samples", params)
        )
      ).data as GenerateSamplesResponse
    ).GeneratedImages;
  }

  async generateImagePrompt(sceneConfig: SceneConfig) {
    return (
      await handleAxiosCall(
        async () =>
          await this.httpClient.post("/generate-image-prompt", sceneConfig)
      )
    ).data as { prompt: string };
  }
}
