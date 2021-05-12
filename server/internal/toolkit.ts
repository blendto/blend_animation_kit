import FormData from "form-data";
import axios from "axios";
import { IncomingMessage } from "http";
import ConfigProvider from "server/base/ConfigProvider";

const TOOLKIT_BASE_URL = ConfigProvider.TOOLKIT_BASE_PATH;

export interface ToolkitErrorResponse {
  code?: string;
  message: string;
}

export default class ToolkitApi {
  httpClient = axios.create({
    baseURL: TOOLKIT_BASE_URL,
  });

  removeBg = async (
    fileBuffer: Buffer,
    fileName: string,
    crop: boolean = false
  ): Promise<IncomingMessage> => {
    const form = new FormData();
    form.append("file", fileBuffer, fileName);
    return (
      await this.httpClient.post("/images/removeBg", form, {
        headers: form.getHeaders(),
        responseType: "stream",
        params: {
          crop: crop.toString(),
        },
      })
    ).data;
  };
}
