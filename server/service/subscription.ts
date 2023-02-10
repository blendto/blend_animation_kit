// noinspection JSMethodCanBeStatic

import axios from "axios";
import { injectable } from "inversify";
import ConfigProvider from "server/base/ConfigProvider";
import { ForbiddenError, UserError } from "server/base/errors";
import { revenueCat } from "server/external/revenue-cat";
import { handleAxiosCall } from "server/helpers/network";
import { IService } from "server/service";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { MinimalBlend } from "server/base/models/blend";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import CreditServiceApi, {
  ListingResponse,
} from "server/internal/creditServiceApi";
import { isEmpty, sum } from "lodash";
import { withExponentialBackoffRetries } from "server/helpers/general";
import {
  RCDefaultEvent,
  RCTransferEvent,
  RevenueCatEvent,
} from "server/engine/webhook/revenue-cat-event";
import { Recipe } from "server/base/models/recipe";
import { RecipeSource } from "server/base/models/recipeList";
import {
  Entitlement,
  FetchEntitlementResponse,
} from "server/base/models/revenue-cat";
import { DaxDB } from "server/external/dax";

export interface SubscriptionEntity {
  adhocCredits: number;
  planCredits: number;
  expiry: number;
  updatedAt: number;
}

interface TransactionEntity {
  doneAt: number;
  blend: MinimalBlend;
}

export enum NoWatermarkReason {
  VERSION_IS_OLD = "VERSION_IS_OLD",
  USER_IS_PRO = "USER_IS_PRO",
  USER_HAS_CREDITS = "USER_HAS_CREDITS",
}

export enum RenewReason {
  ENTICE_INACTIVE_USER = "ENTICE_INACTIVE_USER",
}

export enum CreditAdditionReason {
  WELCOME_REWARD = "WELCOME_REWARD",
  PURCHASE = "PURCHASE",
  REFUND = "REFUND",
  ADMIN_AWARD = "ADMIN_AWARD",
  REFERRER_REWARD = "REFERRER_REWARD",
  REFEREE_REWARD = "REFEREE_REWARD",
  INACTIVE_USER_REWARD = "INACTIVE_USER_REWARD",
  INSTAGRAM_FOLLOWER_REWARD = "INSTAGRAM_FOLLOWER_REWARD",
  SURVEY_FILLER_REWARD = "SURVEY_FILLER_REWARD",
  CONTEST_WINNER_REWARD = "CONTEST_WINNER_REWARD",
  SUPER_BLEND_CREATOR_REWARD = "SUPER_BLEND_CREATOR_REWARD",
}

enum NonCreditAdditionLedgerActivity {
  WATERMARK_FREE_EXPORT = "WATERMARK_FREE_EXPORT",
}

interface LedgerItem {
  activity: NonCreditAdditionLedgerActivity | CreditAdditionReason;
  doneAt: number;
  blend?: MinimalBlend;
  coinsCount: number;
}

interface CanDoWatermarkFreeExportResponse {
  can: boolean;
  noWatermarkReason?: NoWatermarkReason;
  creditServiceActivityLogId?: string;
}

interface GetTransactionsResponse {
  items: TransactionEntity[];
  nextPageToken?: string;
}

interface GetLedgerResponse {
  items: LedgerItem[];
  nextPageToken?: string;
}

enum Source {
  FIREBASE = "firebase",
}

@injectable()
export default class SubscriptionService implements IService {
  // TODO: move all usages of this to creditServiceApi.ts
  httpClient = axios.create({
    baseURL: ConfigProvider.CREDIT_SERVICE_BASE_PATH,
    headers: {
      "x-api-key": ConfigProvider.CREDIT_SERVICE_API_KEY,
    },
  });
  creditServiceApi = new CreditServiceApi();

  private async get(
    userId: string,
    createIfMissing = false
  ): Promise<Record<string, unknown>> {
    const params: {
      source: Source;
      subject: string;
      createIfMissing?: boolean;
      planId?: string;
    } = {
      source: Source.FIREBASE,
      subject: userId,
    };
    if (createIfMissing) {
      params.createIfMissing = true;
      params.planId = ConfigProvider.CREDIT_SERVICE_PLAN_ID;
    }
    return (
      await handleAxiosCall<Record<string, unknown>>(
        async () => await this.httpClient.get(`/v1/subscriptions`, { params })
      )
    ).data;
  }

  async delete(userId: string): Promise<void> {
    await this.creditServiceApi.delete(userId);
  }

  private transform(original: Record<string, unknown>): SubscriptionEntity {
    return {
      adhocCredits: original.adhocCredits as number,
      planCredits: original.planCredits as number,
      expiry: original.expiry as number,
      updatedAt: original.updatedAt as number,
    };
  }

  private createTxnEntity(
    transaction: Record<string, unknown>,
    blendMap: Record<string, MinimalBlend>
  ): TransactionEntity {
    const { blendId } = transaction.metadata as { blendId: string };
    const doneAt = transaction.doneAt as number;
    const blend = blendMap[blendId];
    return { doneAt, blend };
  }

  async getOrCreate(userId: string): Promise<SubscriptionEntity> {
    return this.transform(await this.get(userId, true));
  }

  getWaterMarkBuildVersion(): number {
    return ConfigProvider.WATERMARK_BUILD_VERSION;
  }

  async readEntitlementsCachePopulateIfMissing(
    userId: string
  ): Promise<FetchEntitlementResponse> {
    const record = await this.getCachedEntitlements(userId);

    if (record) return record;
    await this.fetchAndUpdateUserEntitlementsCache(userId);
    return await this.getCachedEntitlements(userId);
  }

  private async getCachedEntitlements(userId: string) {
    const db = diContainer.get<DaxDB>(TYPES.DaxDB);
    return (await db.getItem({
      TableName: ConfigProvider.USER_ENTITLEMENTS_TABLE,
      Key: { userId },
      ConsistentRead: true,
    })) as FetchEntitlementResponse;
  }

  async userHasEntitlement(
    userId: string,
    entitlement: Entitlement
  ): Promise<boolean> {
    const { entitlements, expiry } =
      await this.readEntitlementsCachePopulateIfMissing(userId);
    return entitlements.includes(entitlement) && expiry > Date.now();
  }

  async hasRevenueCatHDExportEntitlement(userId: string): Promise<boolean> {
    return await this.userHasEntitlement(userId, Entitlement.HD_EXPORT);
  }

  async ensureEntitlement(userId: string, entitlement: Entitlement) {
    if (!(await this.userHasEntitlement(userId, entitlement))) {
      throw new ForbiddenError(`User doesn't have ${entitlement} entitlement`);
    }
  }

  async ensureBrandingEntitlement(
    recipe: Recipe,
    source: RecipeSource,
    userId: string
  ) {
    const doesRecipeHaveBranding =
      source === RecipeSource.BRANDING || !isEmpty(recipe.branding);
    if (doesRecipeHaveBranding) {
      await this.ensureEntitlement(userId, Entitlement.BRANDING);
    }
  }

  async canDoWatermarkFreeExport(
    buildVersion: number,
    userId: string,
    blendId: string,
    clientType?: string
  ): Promise<CanDoWatermarkFreeExportResponse> {
    if (buildVersion < this.getWaterMarkBuildVersion()) {
      const noWatermarkReason = NoWatermarkReason.VERSION_IS_OLD;
      return { can: true, noWatermarkReason };
    }

    const isUserEntitled = await this.hasRevenueCatHDExportEntitlement(userId);
    if (isUserEntitled) {
      const noWatermarkReason = NoWatermarkReason.USER_IS_PRO;
      return { can: true, noWatermarkReason };
    }

    if (!isUserEntitled && clientType === "WEB") {
      return { can: false };
    }

    try {
      const res = await this.useCredit(userId, blendId);
      const noWatermarkReason = NoWatermarkReason.USER_HAS_CREDITS;
      const { activityLogId: creditServiceActivityLogId } = res.data;
      return { can: true, noWatermarkReason, creditServiceActivityLogId };
    } catch (err) {
      if (
        !(err instanceof UserError) ||
        // TODO: Add error codes to credit service and use it to verify
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

    return { can: false };
  }

  private async useCredit(userId: string, blendId: string) {
    return await handleAxiosCall<{
      activityLogId: string;
    }>(
      async () =>
        await this.httpClient.post(`/v1/transactions`, {
          source: Source.FIREBASE,
          subject: userId,
          transactionTypeId:
            ConfigProvider.CREDIT_SERVICE_EXPORT_TRANSACTION_TYPE_ID,
          metadata: { blendId },
        })
    );
  }

  async reverseCreditUsage(creditServiceActivityLogId: string): Promise<void> {
    await handleAxiosCall<{ creditServiceActivityLogId: string }>(
      async () =>
        await this.httpClient.post(`/v1/transactions/reverse`, {
          activityLogId: creditServiceActivityLogId,
        })
    );
  }

  async renew(
    userId: string,
    reason: RenewReason
  ): Promise<SubscriptionEntity> {
    return this.transform(
      await this.creditServiceApi.renew(userId, { reason })
    );
  }

  async addCredits(
    userId: string,
    count: number,
    reason = CreditAdditionReason.PURCHASE
  ): Promise<SubscriptionEntity> {
    return this.transform(
      // This is sometimes called concurrently to creation of a credits account.
      // Wait out eventual creation with retries as necessary
      await withExponentialBackoffRetries(
        (userId: string, count: number, reason: CreditAdditionReason) =>
          this.creditServiceApi.addCredits(userId, count, { reason }),
        [userId, count, reason]
      )
    );
  }

  async getTransactions(
    userId: string,
    pageToken?: string
  ): Promise<GetTransactionsResponse> {
    const transactions = await this.creditServiceApi.fetchTransactions(
      userId,
      pageToken
    );

    const blendIds = new Set(
      transactions.items.map(
        (original) => (original.metadata as { blendId: string }).blendId
      )
    );

    const service = diContainer.get<BlendService>(TYPES.BlendService);
    const minimalBlends = await service.getMinimalBlends(Array.from(blendIds));
    const items = this.createTxnEntities(transactions, minimalBlends);

    const { lastItemId, lastItemDoneAt } = transactions;
    if (!lastItemId) {
      return { items };
    }

    const nextPageToken = EncodedPageKey.fromObject({
      lastItemId,
      lastItemDoneAt,
    })?.key;
    return { items, nextPageToken };
  }

  async getLedger(
    userId: string,
    pageToken?: string
  ): Promise<GetLedgerResponse> {
    // This is sometimes called concurrently to creation of a credits account.
    // Wait out eventual creation with retries as necessary
    const creditServiceRes = await withExponentialBackoffRetries(
      (userId: string, pageToken?: string) =>
        this.creditServiceApi.fetchActivityLogs(userId, pageToken),
      [userId, pageToken]
    );

    const blendIds = new Set(
      creditServiceRes.items
        .filter((original) => original.activity === "TRANSACT")
        .map((original) => (original.metadata as { blendId: string }).blendId)
    );
    const minimalBlends = await diContainer
      .get<BlendService>(TYPES.BlendService)
      .getMinimalBlends(Array.from(blendIds));

    const items = this.generateLedgerItems(creditServiceRes, minimalBlends);
    const { lastItemId, lastItemDoneAt } = creditServiceRes;
    if (!lastItemId) {
      return { items };
    }
    const nextPageToken = EncodedPageKey.fromObject({
      lastItemId,
      lastItemDoneAt,
    })?.key;
    return { items, nextPageToken };
  }

  private createTxnEntities(
    transactions: ListingResponse,
    minimalBlends: MinimalBlend[]
  ): TransactionEntity[] {
    const blendMap: Record<string, MinimalBlend> = {};
    minimalBlends.forEach((blend) => {
      blendMap[blend.id] = blend;
    });

    return transactions.items.map((t) => this.createTxnEntity(t, blendMap));
  }

  private generateLedgerItems(
    logs: ListingResponse,
    minimalBlends: MinimalBlend[]
  ): LedgerItem[] {
    const blendMap: Record<string, MinimalBlend> = {};
    minimalBlends.forEach((blend) => {
      blendMap[blend.id] = blend;
    });

    return logs.items.map((i) => {
      let transformedItem: LedgerItem;
      switch (i.activity) {
        case "SUBSCRIBE":
          transformedItem = this.generateWelcomeRewardItem(i);
          break;
        case "ADD_CREDITS":
          transformedItem = this.generateCreditAdditionBasedItem(i);
          break;
        case "TRANSACT":
          transformedItem = this.generateExportItem(i, blendMap);
          break;
        default:
          throw new Error(
            `UNKNOWN_CREDIT_SERVICE_ACTIVITY. Activity: ${i.activity}`
          );
      }
      return transformedItem;
    });
  }

  private generateWelcomeRewardItem(log: Record<string, unknown>): LedgerItem {
    const coinsCount = (
      log.postStateOfSubscription as {
        planCredits: number;
      }
    ).planCredits;
    return {
      activity: CreditAdditionReason.WELCOME_REWARD,
      doneAt: log.doneAt as number,
      coinsCount,
    };
  }

  private generateCreditAdditionBasedItem(
    log: Record<string, unknown>
  ): LedgerItem {
    const { reason } = (log.metadata || {}) as { reason: CreditAdditionReason };
    let activity: CreditAdditionReason;
    if (reason === undefined) {
      // Initially purchases was the only reason and metadata was an empty object.
      activity = CreditAdditionReason.PURCHASE;
    } else {
      activity = reason;
    }

    const coinsCount = (
      log.updateExpression as {
        key: string;
        kind: string;
        value: number;
      }[]
    ).filter((e) => e.key === "adhocCredits")[0].value;

    return {
      activity,
      doneAt: log.doneAt as number,
      coinsCount,
    };
  }

  private generateExportItem(
    log: Record<string, unknown>,
    blendMap: Record<string, MinimalBlend>
  ): LedgerItem {
    const { blendId } = log.metadata as { blendId: string };
    const coinsCount = sum(
      (
        log.updateExpression as {
          key: string;
          kind: string;
          value: number;
        }[]
      )
        .filter((e) => e.key === "adhocCredits" || e.key === "planCredits")
        .map((e) => e.value)
    );
    return {
      activity: NonCreditAdditionLedgerActivity.WATERMARK_FREE_EXPORT,
      doneAt: log.doneAt as number,
      blend: blendMap[blendId],
      coinsCount,
    };
  }

  async processRevenueCatEvent(event: RevenueCatEvent): Promise<void> {
    if (event instanceof RCTransferEvent) {
      const { from, to } = event.getTransferDetails();
      await this.transferUserEntitlementsInCache(from, to);
    }
    if (event instanceof RCDefaultEvent) {
      const { userId } = event.getUpdateDetails();
      await this.fetchAndUpdateUserEntitlementsCache(userId);
    }
  }

  async updateUserEntitlementsCache(
    userId: string,
    entitlements: string[],
    expiry?: number
  ): Promise<void> {
    const db = diContainer.get<DaxDB>(TYPES.DaxDB);
    await db.putItem({
      TableName: ConfigProvider.USER_ENTITLEMENTS_TABLE,
      Item: {
        userId,
        entitlements: entitlements ?? [],
        expiry: expiry ?? Date.now(),
        updatedAt: Date.now(),
      },
    });
  }

  async fetchAndUpdateUserEntitlementsCache(userId: string): Promise<void> {
    const userEntitlements = await revenueCat.getEntitlements(userId);
    await this.updateUserEntitlementsCache(
      userId,
      userEntitlements.entitlements,
      userEntitlements.expiry
    );
  }

  async transferUserEntitlementsInCache(
    sourceUid: string,
    targetUid: string
  ): Promise<void> {
    await Promise.all([
      this.fetchAndUpdateUserEntitlementsCache(sourceUid),
      this.fetchAndUpdateUserEntitlementsCache(targetUid),
    ]);
  }
}
