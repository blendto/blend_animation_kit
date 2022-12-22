import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { handleAxiosCall } from "server/helpers/network";
import ConfigProvider from "server/base/ConfigProvider";

export interface AiStudioGenerateSamplesRequest {
  blendId: string;
  productSuperCategory: string;
  topicId?: string;
  promptId?: string;
}

const { AI_STUDIO_BASE_URL } = ConfigProvider;

export default class AiStudioGeneratorApi {
  httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({ baseURL: AI_STUDIO_BASE_URL });

    axiosRetry(this.httpClient, { retries: 3 });
  }

  async generateSamples(params: AiStudioGenerateSamplesRequest) {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.post("/generate-samples", params)
      )
    ).data;
  }
}
