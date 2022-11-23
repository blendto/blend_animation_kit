import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { handleAxiosCall } from "server/helpers/network";

export enum Entitlement {
  BRANDING = "BRANDING",
  BATCH_EDIT = "BATCH_EDIT",
  HD_EXPORT = "HD_EXPORT",
}

export type Entitlements = {
  [attribute in Entitlement]?: Record<string, unknown>;
};

class RevenueCat {
  httpClient = axios.create({
    baseURL: ConfigProvider.REVENUECAT_API_BASE_PATH,
    headers: {
      Authorization: `Bearer ${ConfigProvider.REVENUECAT_API_KEY}`,
    },
  });

  private async getSubscriber(userId: string) {
    return (
      await handleAxiosCall(
        async () => await this.httpClient.get(`/v1/subscribers/${userId}`)
      )
    ).data;
  }

  async hasEntitlement(
    userId: string,
    entitlement: Entitlement
  ): Promise<boolean> {
    return Promise.resolve(true);
    const subscriptionData = (await this.getSubscriber(userId)) as {
      subscriber?: {
        entitlements: Entitlements;
      };
    };
    return (
      "subscriber" in subscriptionData &&
      entitlement in subscriptionData.subscriber.entitlements &&
      new Date(
        subscriptionData.subscriber.entitlements[entitlement]
          .expires_date as string
      ) > new Date()
    );
  }
}

export const revenueCat = new RevenueCat();
