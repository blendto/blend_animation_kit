import FormData from "form-data";
import axios from "axios";

const TOOLKIT_BASE_URL = "https://toolkit.djfy.io";

export default class ToolkitApi {
  httpClient = axios.create({
    baseURL: TOOLKIT_BASE_URL,
  });

  removeBg = async (fileBuffer: Buffer) => {
    const form = new FormData();
    form.append("file", fileBuffer, "random-file-name.jpg");
    return (
      await this.httpClient.post("/images/removeBg", form, {
        headers: form.getHeaders(),
        responseType: "stream",
      })
    ).data;
  };
}
