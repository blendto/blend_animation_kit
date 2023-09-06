import { DateTime } from "luxon";
import objectHash from "object-hash";
import { inject, injectable } from "inversify";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";
import logger from "server/base/Logger";
import { UserAccountActionType } from "server/base/models/queue-messages";
import DynamoDB from "server/external/dynamodb";
import Firebase from "server/external/firebase";
import { UserAccountActionQueue } from "server/external/queue/userAccountActionQueue";
import { QueueConfig } from "server/external/queue";
import { BlendService } from "./blend";
import HeroImageService from "./heroImage";
import SubscriptionService from "./subscription";
import { IService } from ".";

export enum DeletionPlanStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  SKIPPED_PRO_USER_DELETION_PLAN = "SKIPPED_PRO_USER_DELETION_PLAN",
}

interface DeletionPlan {
  userId: string;
  createdAt: number;
  blendIds: string[];
  heroImageIds: string[];
  deletionDate: string;
  status: DeletionPlanStatus;
}

const UNUSED_FOR_OFFSET_IN_DAYS = 90;
const DELETE_AFTER_OFFSET_IN_DAYS = 7;

@injectable()
export class ProjectsFrictionService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.Firebase) firebase: Firebase;
  @inject(TYPES.SubscriptionService) subscriptionService: SubscriptionService;
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.HeroImageService) heroImageService: HeroImageService;

  async createDeletionPlansForInactiveUsers(date: string): Promise<void> {
    logger.info({
      op: "CREATING_DELETION_PLANS_FOR_INACTIVE_USERS",
      date,
    });
    const dateRightBeforeUnusedOffset = DateTime.fromISO(date)
      .minus({
        days: UNUSED_FOR_OFFSET_IN_DAYS + 1,
      })
      .toISODate();
    const userIds = await this.fetchUserIdsWhoCreatedBlendsOn(
      dateRightBeforeUnusedOffset
    );
    const userAccountActionQueue = diContainer.get<
      UserAccountActionQueue<QueueConfig>
    >(TYPES.UserAccountActionQueue);
    const action = UserAccountActionType.CREATE_DELETION_PLAN_BATCH;
    const userIdsArr = Array.from(userIds);
    const userIdBatchSize = 10;
    const qBatchSize = 10;
    const promises: Promise<void>[] = [];
    while (userIdsArr.length) {
      let currentQBatchSize = 0;
      const userIdBatches: string[][] = [];
      while (userIdsArr.length && currentQBatchSize < qBatchSize) {
        userIdBatches.push(userIdsArr.splice(0, userIdBatchSize));
        currentQBatchSize += 1;
      }
      if (!userIdBatches.length) break;
      promises.push(
        userAccountActionQueue.writeMultipleMessages(
          userIdBatches.map((userIds) => {
            const hash = objectHash.MD5(userIds);
            const dedupId = `${action}-${hash}`;
            return {
              id: dedupId,
              message: {
                action,
                userIds,
              },
              attributes: {
                MessageDeduplicationId: dedupId,
                MessageGroupId: action,
              },
            };
          })
        )
      );
    }
    await Promise.all(promises);
  }

  async fetchUserIdsWhoCreatedBlendsOn(
    createdOn: string
  ): Promise<Set<string>> {
    const userIds: Set<string> = new Set();
    let pageKeyObject: Record<string, unknown> = null;
    do {
      const data = await this.dataStore.queryItems({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        KeyConditionExpression: "#createdOn = :createdOn",
        IndexName: "created-on-idx",
        ExpressionAttributeNames: {
          "#createdOn": "createdOn",
        },
        ExpressionAttributeValues: {
          ":createdOn": createdOn,
        },
        ProjectionExpression: "createdBy",
        ExclusiveStartKey: pageKeyObject,
      });
      (data.Items as { createdBy: string }[]).forEach((i) => {
        userIds.add(i.createdBy);
      });
      pageKeyObject = data.LastEvaluatedKey;
    } while (pageKeyObject);
    return userIds;
  }

  async hasUserBeenInactive(userId: string): Promise<boolean> {
    const res = await this.dataStore.queryItems({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      IndexName: "createdBy-updatedAt-idx",
      KeyConditionExpression: "#createdBy = :createdBy",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
      },
      ExpressionAttributeValues: {
        ":createdBy": userId,
      },
      ProjectionExpression: "updatedAt",
      ScanIndexForward: false,
      Limit: 1,
    });
    if (res.Items[0]) {
      const unusedForOffset = DateTime.utc()
        .minus({ days: UNUSED_FOR_OFFSET_IN_DAYS })
        .valueOf();
      return (
        unusedForOffset > (res.Items as { updatedAt: number }[])[0].updatedAt
      );
    }
    return true;
  }

  async createDeletionPlanBatch(userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((userId) => this.createDeletionPlan(userId)));
  }

  async createDeletionPlan(userId: string): Promise<void> {
    try {
      await this.firebase.getUserById(userId);
    } catch (err) {
      // These were happening as a race condition when a user deletes their account
      return;
    }
    if (!(await this.hasUserBeenInactive(userId))) {
      return;
    }
    if (await this.subscriptionService.hasProEntitlement(userId)) {
      return;
    }
    if ((await this.getPendingDeletionPlans(userId)).length) {
      return;
    }
    const planItem = await this.generateDeletionPlan(userId);
    if (planItem) {
      await this.dataStore.putItem({
        TableName: ConfigProvider.DELETION_PLANS_DYNAMODB_TABLE,
        Item: planItem,
      });
      logger.debug({
        op: "CREATED_DELETION_PLAN",
        userId,
      });
    }
  }

  async getPendingDeletionPlanIfValid(
    userId: string
  ): Promise<DeletionPlan | undefined> {
    const pendingPlans = await this.getPendingDeletionPlans(userId);
    for (const pendingPlan of pendingPlans) {
      const startOfToday = DateTime.utc().startOf("day");
      const startOfDeletionDate = DateTime.fromISO(pendingPlan.deletionDate, {
        zone: "utc",
      }).startOf("day");
      if (startOfToday <= startOfDeletionDate) {
        return pendingPlan;
      }
      // Shouldn't have happened.
      // - Delete the user's plan so that UX isn't affected
      await this.dataStore.deleteItem({
        TableName: ConfigProvider.DELETION_PLANS_DYNAMODB_TABLE,
        Key: {
          userId,
          createdAt: pendingPlan.createdAt,
        },
      });
      // // - Retry plans scheduled on the same date
      // const userAccountActionQueue = diContainer.get<
      //   UserAccountActionQueue<QueueConfig>
      // >(TYPES.UserAccountActionQueue);
      // const action = UserAccountActionType.DELETE_FREE_RESOURCES;
      // await userAccountActionQueue.writeMessage(
      //   {
      //     action,
      //     date: pendingPlan.deletionDate,
      //   },
      //   {
      //     MessageDeduplicationId: `${action}-${pendingPlan.deletionDate}`,
      //     MessageGroupId: action,
      //   }
      // );
    }
    return null;
  }

  private async getPendingDeletionPlans(
    userId: string
  ): Promise<DeletionPlan[]> {
    const queryRes = await this.dataStore.queryItems({
      TableName: ConfigProvider.DELETION_PLANS_DYNAMODB_TABLE,
      KeyConditionExpression: "#userId = :userId",
      ScanIndexForward: false,
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#userId": "userId",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
        ":status": DeletionPlanStatus.PENDING,
      },
    });
    return queryRes.Items as DeletionPlan[];
  }

  private async generateDeletionPlan(
    userId: string
  ): Promise<DeletionPlan | null> {
    const now = DateTime.utc();
    const unusedForOffset = now
      .minus({ days: UNUSED_FOR_OFFSET_IN_DAYS })
      .valueOf();
    const unusedBlendIds = await this.blendService.getUnusedBlendIds(
      userId,
      unusedForOffset
    );
    const unusedImageIds = await this.heroImageService.getUnusedImageIds(
      userId,
      unusedForOffset
    );
    if (unusedBlendIds.length || unusedImageIds.length) {
      return {
        userId,
        createdAt: now.valueOf(),
        blendIds: unusedBlendIds,
        heroImageIds: unusedImageIds,
        deletionDate: now
          .plus({ days: DELETE_AFTER_OFFSET_IN_DAYS })
          .toISODate(),
        status: DeletionPlanStatus.PENDING,
      };
    }
    return null;
  }

  async executeScheduledDeletionPlans(date: string): Promise<void> {
    const now = DateTime.utc();
    if (DateTime.fromISO(date).diff(now, ["days"]).days > 0) {
      logger.error({
        op: "EARLY_EXECUTION_ATTEMPT_OF_DELETION_PLAN",
        attemptedDate: date,
        currentDate: now.toISODate(),
      });
      return;
    }

    logger.info({
      op: "EXECUTING_DELETION_PLANS_FOR_INACTIVE_USERS",
      date,
    });
    const plans = await this.getScheduledDeletionPlans(date);
    const userAccountActionQueue = diContainer.get<
      UserAccountActionQueue<QueueConfig>
    >(TYPES.UserAccountActionQueue);
    const action = UserAccountActionType.EXECUTE_DELETION_PLAN_BATCH;
    const planBatchSize = 10;
    const qBatchSize = 10;
    const promises: Promise<void>[] = [];
    while (plans.length) {
      let currentQBatchSize = 0;
      const planBatches: {
        userId: string;
        createdAt: number;
      }[][] = [];
      while (plans.length && currentQBatchSize < qBatchSize) {
        planBatches.push(plans.splice(0, planBatchSize));
        currentQBatchSize += 1;
      }
      if (!planBatches.length) break;
      promises.push(
        userAccountActionQueue.writeMultipleMessages(
          planBatches.map((plans) => {
            const hash = objectHash.MD5(plans);
            const dedupId = `${action}-${hash}`;
            return {
              id: dedupId,
              message: {
                action,
                plans,
              },
              attributes: {
                MessageDeduplicationId: dedupId,
                MessageGroupId: action,
              },
            };
          })
        )
      );
    }
    await Promise.all(promises);
  }

  async executeDeletionPlanBatch(
    plans: { userId: string; createdAt: number }[]
  ) {
    await Promise.all(
      plans.map((plan) => this.executeDeletionPlan(plan.userId, plan.createdAt))
    );
  }

  private async executeDeletionPlan(userId: string, createdAt: number) {
    if (await this.subscriptionService.hasProEntitlement(userId)) {
      await this.updateDeletionPlanStatus(
        userId,
        createdAt,
        DeletionPlanStatus.SKIPPED_PRO_USER_DELETION_PLAN
      );
      logger.debug({
        op: "SKIPPED_DELETION_PLAN_AS_USER_TURNED_PRO",
        userId,
        createdAt,
      });
      return;
    }
    const plan = (await this.dataStore.getItem({
      TableName: ConfigProvider.DELETION_PLANS_DYNAMODB_TABLE,
      Key: { userId, createdAt },
    })) as DeletionPlan | null;
    if (!plan && plan.status !== DeletionPlanStatus.PENDING) {
      return;
    }
    const now = DateTime.utc();
    if (DateTime.fromISO(plan.deletionDate).diff(now, ["days"]).days > 0) {
      logger.error({
        op: "EARLY_EXECUTION_ATTEMPT_OF_DELETION_PLAN",
        attemptedDate: plan.deletionDate,
        currentDate: now.toISODate(),
      });
      return;
    }
    await this.blendService.deleteBlends(plan.blendIds);
    await this.heroImageService.deleteHeroImages(plan.heroImageIds);
    await this.updateDeletionPlanStatus(
      plan.userId,
      plan.createdAt,
      DeletionPlanStatus.COMPLETED
    );
    logger.debug({
      op: "EXECUTED_DELETION_PLAN",
      userId: plan.userId,
    });
  }

  private async getScheduledDeletionPlans(
    date: string
  ): Promise<{ userId: string; createdAt: number }[]> {
    let plans: DeletionPlan[] = [];
    let pageKeyObject: Record<string, unknown> = null;
    do {
      const data = await this.dataStore.queryItems({
        TableName: ConfigProvider.DELETION_PLANS_DYNAMODB_TABLE,
        KeyConditionExpression: "#deletionDate = :deletionDate",
        IndexName: "deletionDate-index",
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: {
          "#deletionDate": "deletionDate",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":deletionDate": date,
          ":status": DeletionPlanStatus.PENDING,
        },
        ExclusiveStartKey: pageKeyObject,
        ProjectionExpression: "userId, createdAt",
      });
      plans = plans.concat(data.Items as DeletionPlan[]);
      pageKeyObject = data.LastEvaluatedKey;
    } while (pageKeyObject);
    return plans;
  }

  private async updateDeletionPlanStatus(
    userId: string,
    createdAt: number,
    status: DeletionPlanStatus
  ): Promise<void> {
    await this.dataStore.updateItem({
      TableName: ConfigProvider.DELETION_PLANS_DYNAMODB_TABLE,
      Key: { userId, createdAt },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
      },
    });
  }
}
