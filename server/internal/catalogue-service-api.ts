import axios from "axios";
import { injectable } from "inversify";
import ConfigProvider from "server/base/ConfigProvider";
import { handleAxiosCall } from "server/helpers/network";

@injectable()
export default class CatalogueServiceApi {
  httpClient = axios.create({
    baseURL: ConfigProvider.CATALOGUE_SERVICE_BASE_PATH,
    headers: {
      "X-Api-Key": ConfigProvider.INTER_SERVICE_API_KEY,
      "X-Api-Version": 1,
    },
  });

  async migrate(anonymousUserID: string, signedUserID: string): Promise<void> {
    await handleAxiosCall<Record<string, unknown>>(
      async () =>
        await this.httpClient.post("/store/migrate", {
          anonymousUserID,
          signedUserID,
        })
    );
  }
}
