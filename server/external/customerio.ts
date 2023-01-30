import axios from "axios";
import { injectable } from "inversify";
import ConfigProvider from "server/base/ConfigProvider";

export enum TrackableEvent {
  SUCCESSFUL_REFERRAL = "successful_referral",
}

@injectable()
export default class CustomerIOService {
  httpClient = axios.create({
    baseURL: "https://track.customer.io",
    auth: {
      username: ConfigProvider.CUSTOMER_IO_SITE_ID,
      password: ConfigProvider.CUSTOMER_IO_API_KEY,
    },
  });

  async markCountryForUser(userId: string, countyCode: string) {
    await this.httpClient.post("/api/v2/entity", {
      type: "person",
      identifiers: { id: userId },
      action: "identify",
      attributes: {
        countyCode,
      },
    });
  }

  async trackEvent(
    userId: string,
    eventName: TrackableEvent,
    attributes: Record<string, string | number>
  ) {
    await this.httpClient.post("/api/v2/entity", {
      type: "person",
      identifiers: { id: userId },
      action: "event",
      name: eventName.toString(),
      attributes,
    });
  }
}
