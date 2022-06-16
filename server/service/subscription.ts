import axios from "axios";
import { injectable } from "inversify";
import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import { Entitlement, revenueCat } from "server/external/revenue-cat";
import { handleAxiosCall } from "server/helpers/network";
import { IService } from "server/service";

interface SubscriptionEntity {
  adhocCredits: number;
  planCredits: number;
  expiry: number;
  updatedAt: number;
}

export enum NoWatermarkReason {
  VERSION_IS_OLD = "VERSION_IS_OLD",
  USER_IS_PRO = "USER_IS_PRO",
  USER_HAS_CREDITS = "USER_HAS_CREDITS",
}

interface CanDoWatermarkFreeExportResponse {
  can: boolean;
  noWatermarkReason?: NoWatermarkReason;
  creditServiceActivityLogId?: string;
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
        // TODO: Add error codes to credit service and user it to verify
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

  getWaterMarkBuildVersion(): number {
    return ConfigProvider.WATERMARK_BUILD_VERSION;
  }

  async hasRevenueCatHDExportEntitlement(userId: string): Promise<boolean> {
    return await revenueCat.hasEntitlement(userId, Entitlement.HD_EXPORT);
  }

  async canDoWatermarkFreeExport(
    buildVersion: number,
    userId: string,
    blendId: string
  ): Promise<CanDoWatermarkFreeExportResponse> {
    const res: CanDoWatermarkFreeExportResponse = {
      can: false,
    };
    if (buildVersion < this.getWaterMarkBuildVersion()) {
      res.can = true;
      res.noWatermarkReason = NoWatermarkReason.VERSION_IS_OLD;
    } else if (await this.hasRevenueCatHDExportEntitlement(userId)) {
      res.can = true;
      res.noWatermarkReason = NoWatermarkReason.USER_IS_PRO;
    } else {
      try {
        const axiosRes = await handleAxiosCall<{
          creditServiceActivityLogId: string;
        }>(
          async () =>
            await this.httpClient.post(`/v1/transactions`, {
              source: "firebase",
              subject: userId,
              transactionTypeId:
                ConfigProvider.CREDIT_SERVICE_EXPORT_TRANSACTION_TYPE_ID,
              metadata: { blendId },
            })
        );
        res.can = true;
        res.noWatermarkReason = NoWatermarkReason.USER_HAS_CREDITS;
        res.creditServiceActivityLogId =
          axiosRes.data.creditServiceActivityLogId;
      } catch (err) {
        if (
          !(err instanceof UserError) ||
          // TODO: Add error codes to credit service and user it to verify
          !["Expired/Insufficient credits", "Subscription not found"].includes(
            /* eslint-disable-next-line
                @typescript-eslint/no-unsafe-argument,
                @typescript-eslint/no-unsafe-member-access
            */
            JSON.parse(err.message).message
          )
        ) {
          throw err;
        }
      }
    }
    return res;
  }

  async reverseCreditUsage(creditServiceActivityLogId: string): Promise<void> {
    await handleAxiosCall<{ creditServiceActivityLogId: string }>(
      async () =>
        await this.httpClient.post(`/v1/transactions/reverse`, {
          creditServiceActivityLogId,
        })
    );
  }

  async addCredits(
    userId: string,
    count: number
  ): Promise<Record<string, unknown>> {
    return (
      await handleAxiosCall<Record<string, unknown>>(
        async () =>
          await this.httpClient.post(`/v1/subscriptions/credits`, {
            source: "firebase",
            subject: userId,
            creditsToAdd: count,
          })
      )
    ).data;
  }
}
