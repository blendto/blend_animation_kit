import { DocumentClient } from "aws-sdk/clients/dynamodb";
import Bottleneck from "bottleneck";
import { DateTime } from "luxon";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import logger from "server/base/Logger";
import DynamoDB from "server/external/dynamodb";
import Firebase from "server/external/firebase";
import { IService } from ".";
import { BlendService } from "./blend";
import HeroImageService from "./heroImage";
import SubscriptionService from "./subscription";

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
    const dateRightBeforeUnusedOffset = DateTime.fromISO(date)
      .minus({
        days: UNUSED_FOR_OFFSET_IN_DAYS + 1,
      })
      .toISODate();
    const userIds = await this.fetchUserIdsWhoCreatedBlendsOn(
      dateRightBeforeUnusedOffset
    );
    let usersFoundInactive = 0;
    const bottleneck = new Bottleneck({ maxConcurrent: 10 });
    const createDeletionPlanIfApplicable = async (userId: string) => {
      if (await this.hasUserBeenInactive(userId)) {
        usersFoundInactive += 1;
        await this.createDeletionPlan(userId);
      }
    };
    await Promise.all(
      Array.from(userIds).map((userId) =>
        bottleneck.schedule(() => createDeletionPlanIfApplicable(userId))
      )
    );
    logger.info({
      op: "CREATED_DELETION_PLANS_FOR_INACTIVE_USERS",
      date,
      totalUniqueUsers: userIds.size,
      usersFoundInactive,
    });
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

  async createDeletionPlan(userId: string): Promise<void> {
    try {
      await this.firebase.getUserById(userId);
    } catch (err) {
      // These were happening as a race condition when a user deletes their account
      return;
    }
    if (await this.subscriptionService.hasProEntitlement(userId)) {
      return;
    }
    if (await this.hasPendingDeletionPlan(userId)) {
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

  private async hasPendingDeletionPlan(userId: string): Promise<boolean> {
    const lastCreated = await this.getLastCreatedDeletionPlan(userId);
    return lastCreated?.status === DeletionPlanStatus.PENDING;
  }

  async getLastCreatedDeletionPlan(
    userId: string
  ): Promise<DeletionPlan | undefined> {
    const queryRes = await this.dataStore.queryItems({
      TableName: ConfigProvider.DELETION_PLANS_DYNAMODB_TABLE,
      KeyConditionExpression: "#userId = :userId",
      ScanIndexForward: false,
      ExpressionAttributeNames: {
        "#userId": "userId",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      Limit: 1,
    });
    return (queryRes.Items as DeletionPlan[])[0];
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
      throw new UserError(
        "A deletion plan can't be executed before it's scheduled date"
      );
    }

    const plans = await this.getScheduledDeletionPlans(date);
    const bottleneck = new Bottleneck({ maxConcurrent: 25 });
    await Promise.all(
      plans.map((plan) =>
        bottleneck.schedule(() => this.executeDeletionPlan(plan))
      )
    );
    logger.info({
      op: "EXECUTED_DELETION_PLANS_FOR_INACTIVE_USERS",
      date,
    });
  }

  private async executeDeletionPlan(plan: DeletionPlan) {
    if (await this.subscriptionService.hasProEntitlement(plan.userId)) {
      await this.updateDeletionPlanStatus(
        plan.userId,
        plan.createdAt,
        DeletionPlanStatus.SKIPPED_PRO_USER_DELETION_PLAN
      );
      logger.debug({
        op: "SKIPPED_DELETION_PLAN_AS_USER_TURNED_PRO",
        plan,
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

  async cleanupOldProjects(userId: string) {
    if (await this.subscriptionService.hasProEntitlement(userId)) {
      logger.debug({
        op: "SKIPPED_INACTIVE_USER_PROJECTS_CLEANUP_AS_USER_IS_PRO",
        userId,
      });
      return;
    }
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
    await this.blendService.deleteBlends(unusedBlendIds);
    await this.heroImageService.deleteHeroImages(unusedImageIds);
    logger.info({
      op: "EXECUTED_INACTIVE_USER_PROJECTS_CLEANUP",
      userId,
      unusedBlendIds,
      unusedImageIds,
    });
  }

  private async getScheduledDeletionPlans(
    date: string
  ): Promise<DeletionPlan[]> {
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
