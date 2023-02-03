import axios from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { handleAxiosCall } from "server/helpers/network";

export enum Entitlement {
  BRANDING = "BRANDING",
  BATCH_EDIT = "BATCH_EDIT",
  HD_EXPORT = "HD_EXPORT",
}

export type Entitlements = {
  [attribute in Entitlement]?: {
    expires_date: string;
  };
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

  async hasEntitlement(userId: string, entitlement: Entitlement) {
    const subscriptionData = (await this.getSubscriber(userId)) as {
      subscriber?: {
        entitlements: Entitlements;
      };
    };
    return (
      "subscriber" in subscriptionData &&
      entitlement in subscriptionData.subscriber.entitlements &&
      new Date(
        subscriptionData.subscriber.entitlements[entitlement].expires_date
      ) > new Date()
    );
  }

  async getEntitlements(
    userId: string
  ): Promise<{ entitlements: string[]; expiry: number }> {
    const subscriptionData = (await this.getSubscriber(userId)) as {
      subscriber?: {
        entitlements: Entitlements;
      };
    };

    const entitlements = subscriptionData.subscriber?.entitlements ?? {};

    // Here we are considering entitlement expiry to be the max of all expiry
    // as user is assigned all entitlements together. This will most likely
    // change in the future
    let expiry: number = null;
    Object.entries(entitlements).forEach(([, val]) => {
      expiry = Math.max(new Date(val.expires_date).getTime(), expiry);
    });

    return { entitlements: Object.keys(entitlements), expiry };
  }
}

export const revenueCat = new RevenueCat();
