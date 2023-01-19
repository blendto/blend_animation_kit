import { diContainer } from "inversify.config";
import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { TYPES } from "server/types";
import { DaxDB } from "./dax";

interface IPInfo {
  country_code: string;
  [key: string]: unknown;
}

export default class IpApi {
  httpClient = axios.create({
    baseURL: "http://api.ipapi.com/",
    params: {
      access_key: ConfigProvider.IPAPI_ACCESS_KEY,
    },
    timeout: 3000, // 3 seconds
  });

  async getIpInfo(ip: string) {
    const daxStore = diContainer.get<DaxDB>(TYPES.DaxDB);
    let data: IPInfo;
    const response = (await daxStore.getItem({
      TableName: ConfigProvider.IP_DETAILS_CACHE_TABLE,
      Key: { ip },
    })) as { info: IPInfo } | void;
    if (response) {
      data = response.info;
    } else {
      const response = await this.httpClient.get(`/api/${ip}`);
      ({ data } = response as { data: IPInfo });
      const now = new Date();
      const nowPlus7Days = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
      await daxStore.putItem({
        TableName: ConfigProvider.IP_DETAILS_CACHE_TABLE,
        Item: {
          ip,
          info: data,
          expireAt: nowPlus7Days.getTime(),
        },
      });
    }
    return data;
  }
}
