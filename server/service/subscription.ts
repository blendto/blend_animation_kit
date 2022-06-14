import axios from "axios";
import { injectable } from "inversify";
import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import { handleAxiosCall } from "server/helpers/network";
import { IService } from "server/service";

export interface SubscriptionEntity {
  adhocCredits: number;
  planCredits: number;
  expiry: number;
  updatedAt: number;
}
@injectable()
export default class SubscriptionService implements IService {
  httpClient = axios.create({
    baseURL: ConfigProvider.CREDIT_SERVICE_BASE_PATH,
    headers: {
      "x-api-key": ConfigProvider.CREDIT_SERVICE_API_KEY,
    },
  });

  private async get(userId: string): Promise<Record<string, unknown>> {
    return (
      await handleAxiosCall<Record<string, unknown>>(
        async () =>
          await this.httpClient.get(
            `/v1/subscriptions?source=firebase&subject=${userId}`
          )
      )
    ).data;
  }

  private async create(userId: string): Promise<Record<string, unknown>> {
    return (
      await handleAxiosCall<Record<string, unknown>>(
        async () =>
          await this.httpClient.post(`/v1/subscriptions`, {
            source: "firebase",
            subject: userId,
            planId: ConfigProvider.CREDIT_SERVICE_PLAN_ID,
          })
      )
    ).data;
  }

  private transform(original: Record<string, unknown>): SubscriptionEntity {
    return {
      adhocCredits: original.adhocCredits as number,
      planCredits: original.planCredits as number,
      expiry: original.expiry as number,
      updatedAt: original.updatedAt as number,
    };
  }

  async getOrCreate(userId: string): Promise<SubscriptionEntity> {
    let subscription: Record<string, unknown>;
    try {
      subscription = await this.get(userId);
    } catch (error) {
      if (
        error instanceof UserError &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        JSON.parse(error.message).message === "Subscription not found"
      ) {
        subscription = await this.create(userId);
      } else {
        throw error;
      }
    }
    return this.transform(subscription);
  }
}
