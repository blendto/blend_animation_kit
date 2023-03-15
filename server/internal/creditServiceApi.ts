// noinspection JSMethodCanBeStatic

import axios from "axios";
import { handleAxiosCall } from "server/helpers/network";
import ConfigProvider from "server/base/ConfigProvider";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import qs from "qs";

export interface ListingPageIdentifier {
  lastItemId?: string;
  lastItemDoneAt?: number;
}

export interface ListingResponse extends ListingPageIdentifier {
  items: Record<string, unknown>[];
}

enum Source {
  FIREBASE = "firebase",
}

export default class CreditServiceApi {
  httpClient = axios.create({
    baseURL: ConfigProvider.CREDIT_SERVICE_BASE_PATH,
    headers: {
      "x-api-key": ConfigProvider.CREDIT_SERVICE_API_KEY,
    },
  });

  async renew(
    userId: string,
    metadata: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const data = { source: Source.FIREBASE, subject: userId, metadata };
    return (
      await handleAxiosCall<Record<string, unknown>>(
        async () => await this.httpClient.post(`/v1/subscriptions/renew`, data)
      )
    ).data;
  }

  async delete(userId: string): Promise<void> {
    await handleAxiosCall<Record<string, unknown>>(
      async () =>
        await this.httpClient.delete(
          `/v1/subscriptions?source=${Source.FIREBASE}&subject=${userId}`
        )
    );
  }

  async addCredits(
    userId: string,
    count: number,
    metadata: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const data = {
      source: Source.FIREBASE,
      subject: userId,
      creditsToAdd: count,
      metadata,
    };
    return (
      await handleAxiosCall<Record<string, unknown>>(
        async () =>
          await this.httpClient.post(`/v1/subscriptions/credits`, data)
      )
    ).data;
  }

  async fetchTransactions(
    userId: string,
    pageToken: string
  ): Promise<ListingResponse> {
    const url = this.listingURL("/v1/transactions", userId, pageToken);
    return (await handleAxiosCall(async () => await this.httpClient.get(url)))
      .data as ListingResponse;
  }

  async fetchActivityLogs(
    userId: string,
    pageToken: string
  ): Promise<ListingResponse> {
    const url = this.listingURL("/v1/activity_logs", userId, pageToken);
    return (await handleAxiosCall(async () => await this.httpClient.get(url)))
      .data as ListingResponse;
  }

  private listingURL(path: string, userId: string, pageToken: string) {
    const pageKey = new EncodedPageKey(pageToken);

    const params = { source: Source.FIREBASE, subject: userId };

    const url = path;
    if (!pageKey.exists()) {
      return `${url}?${qs.stringify(params)}`;
    }
    const { lastItemId, lastItemDoneAt } =
      pageKey.decode() as ListingPageIdentifier;
    const updatedParams = { lastItemId, lastItemDoneAt, ...params };
    return `${url}?${qs.stringify(updatedParams)}`;
  }
}
