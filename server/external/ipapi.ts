import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";

export default class IpApi {
  httpClient = axios.create({
    baseURL: "http://api.ipapi.com/",
    params: {
      access_key: ConfigProvider.IPAPI_ACCESS_KEY,
    },
  });

  async getIpInfo(ipAddress: string) {
    const response = await this.httpClient.get(`/api/${ipAddress}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
  }
}
