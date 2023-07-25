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
const ENCODER_VERSION = 4.2;

@injectable()
export class ProjectsFrictionService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.Firebase) firebase: Firebase;
  @inject(TYPES.SubscriptionService) subscriptionService: SubscriptionService;
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.HeroImageService) heroImageService: HeroImageService;

  async createDeletionPlan(
    userId: string,
    encoderVersion: number
  ): Promise<void> {
    if (encoderVersion < ENCODER_VERSION) {
      return;
    }
    try {
      await this.firebase.getUserById(userId);
    } catch (err) {
      // These were happening as a race condition when a user deletes their account
      return;
    }
    if (await this.subscriptionService.isUserPro(userId)) {
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
      logger.info({
        op: "CREATED_DELETION_PLAN",
        planItem,
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
      const op = "EARLY_EXECUTION_ATTEMPT_OF_DELETION_PLAN";
      logger.error({
        op,
        attemptedDate: date,
        currentDate: now.toISODate(),
      });
      throw new UserError(
        "A deletion plan can't be executed before it's scheduled date"
      );
    }
    const limiter = new Bottleneck({
      minTime: 1000,
      maxConcurrent: 1,
    });
    let pageKeyObject: Record<string, unknown>;
    do {
      pageKeyObject = await limiter.schedule(() =>
        this.executeNextScheduledDeletionPlan(date, pageKeyObject)
      );
    } while (pageKeyObject);
  }

  private async executeNextScheduledDeletionPlan(
    date: string,
    pageKeyObject: Record<string, unknown>
  ) {
    const [plan, nextPageKeyObject] = await this.getNextScheduledDeletionPlan(
      date,
      pageKeyObject
    );
    if (plan) {
      if (await this.subscriptionService.isUserPro(plan.userId)) {
        await this.updateDeletionPlanStatus(
          plan.userId,
          plan.createdAt,
          DeletionPlanStatus.SKIPPED_PRO_USER_DELETION_PLAN
        );
        logger.info({
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
      logger.info({
        op: "EXECUTED_DELETION_PLAN",
        plan,
      });
    }
    return nextPageKeyObject;
  }

  async cleanupOldProjects(userId: string) {
    if (await this.subscriptionService.isUserPro(userId)) {
      logger.info({
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
    logger.info({
      op: "EXECUTING_INACTIVE_USER_PROJECTS_CLEANUP",
      userId,
      unusedBlendIds,
      unusedImageIds,
    });
    await this.blendService.deleteBlends(unusedBlendIds);
    await this.heroImageService.deleteHeroImages(unusedImageIds);
    logger.info({
      op: "EXECUTED_INACTIVE_USER_PROJECTS_CLEANUP",
      userId,
    });
  }

  private async getNextScheduledDeletionPlan(
    isoDate: string,
    pageKeyObject: Record<string, unknown>
  ): Promise<[DeletionPlan, Record<string, unknown>]> {
    const queryInput: DocumentClient.QueryInput = {
      TableName: ConfigProvider.DELETION_PLANS_DYNAMODB_TABLE,
      KeyConditionExpression: "#deletionDate = :deletionDate",
      IndexName: "deletionDate-index",
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#deletionDate": "deletionDate",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":deletionDate": isoDate,
        ":status": DeletionPlanStatus.PENDING,
      },
      Limit: 1,
    };
    if (pageKeyObject) {
      queryInput.ExclusiveStartKey = pageKeyObject;
    }
    const res = await this.dataStore.queryItems(queryInput);
    return [(res.Items as DeletionPlan[])[0], res.LastEvaluatedKey];
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
