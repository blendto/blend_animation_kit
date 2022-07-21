// noinspection JSMethodCanBeStatic

import axios from "axios";
import { handleAxiosCall } from "server/helpers/network";
import ConfigProvider from "server/base/ConfigProvider";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import qs from "qs";

export interface TransactionPageIdentifier {
  lastItemId?: string;
  lastItemDoneAt?: number;
}

export interface FetchTransactionResponse extends TransactionPageIdentifier {
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

  async fetchTransactions(
    userId: string,
    pageToken: string
  ): Promise<FetchTransactionResponse> {
    const url = this.transactionsURL(userId, pageToken);
    return (await handleAxiosCall(async () => await this.httpClient.get(url)))
      .data as FetchTransactionResponse;
  }

  private transactionsURL(userId: string, pageToken: string) {
    const pageKey = new EncodedPageKey(pageToken);

    const params = { source: Source.FIREBASE, subject: userId };

    const url = `/v1/transactions`;
    if (!pageKey.exists()) {
      return `${url}?${qs.stringify(params)}`;
    }
    const { lastItemId, lastItemDoneAt } =
      pageKey.decode() as TransactionPageIdentifier;
    const updatedParams = { lastItemId, lastItemDoneAt, ...params };
    return `${url}?${qs.stringify(updatedParams)}`;
  }
}
