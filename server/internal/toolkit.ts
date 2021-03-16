import FormData from "form-data";
import axios from "axios";
import { IncomingMessage } from "http";

const TOOLKIT_BASE_URL = "https://toolkit.djfy.io";

export default class ToolkitApi {
  httpClient = axios.create({
    baseURL: TOOLKIT_BASE_URL,
  });

  removeBg = async (
    fileBuffer: Buffer,
    fileName: string
  ): Promise<IncomingMessage> => {
    const form = new FormData();
    form.append("file", fileBuffer, fileName);
    return (
      await this.httpClient.post("/images/removeBg", form, {
        headers: form.getHeaders(),
        responseType: "stream",
      })
    ).data;
  };
}
