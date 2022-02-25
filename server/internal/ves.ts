import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { handleAxiosCall } from "server/helpers/network";

const VES_SERVICE_BASE_URL = ConfigProvider.VES_API_BASE_PATH;

export interface PreviewRequestParams {
  recipeId: string;
  fileKeys: {
    original: string;
    withoutBg: string;
  };
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
}
