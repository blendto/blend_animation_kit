import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";

export default class IpApi {
  httpClient = axios.create({
    baseURL: "http://api.ipapi.com/",
    params: {
      access_key: ConfigProvider.IPAPI_ACCESS_KEY,
    },
    timeout: 3000, // 3 seconds
  });

  async getIpInfo(ipAddress: string) {
    const response = await this.httpClient.get(`/api/${ipAddress}`);
    return response.data;
  }
}
