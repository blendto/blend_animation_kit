import { diContainer } from "inversify.config";
import logger from "server/base/Logger";
import { TYPES } from "server/types";
import { BatchTaskQueue } from "server/external/queue/batchTaskQueue";
import { QueueConfig } from "server/external/queue";
import { BatchActionService } from "server/service/queue/batch/batchAction";
import { UploadService } from "server/service/queue/upload";
import { ImageUploadEventQueue } from "server/external/queue/imageUploadQueue";
import tracer from "dd-trace";
import {
  UserAccountActionMessage,
  BatchTaskMessage,
  ImageUploadMessage,
  UserAccountActionType,
} from "server/base/models/queue-messages";
import { UserService } from "server/service/user";
import { UserAccountActionQueue } from "server/external/queue/userAccountActionQueue";
import { ProjectsFrictionService } from "server/service/projects-friction-service";
import SubscriptionService from "server/service/subscription";

const SIMULTANEOUS_QUEUE_COUNT = 10;

const batchActionService = diContainer.get<BatchActionService>(
  TYPES.BatchActionService
);
const batchTaskQueue = diContainer.get<BatchTaskQueue<QueueConfig>>(
  TYPES.BatchTaskQueue
);
const uploadService = diContainer.get<UploadService>(TYPES.UploadService);
const uploadEventQueue = diContainer.get<ImageUploadEventQueue<QueueConfig>>(
  TYPES.ImageUploadEventQueue
);
const userService = diContainer.get<UserService>(TYPES.UserService);
const subscriptionService = diContainer.get<SubscriptionService>(
  TYPES.SubscriptionService
);
const userAccountActionQueue = diContainer.get<
  UserAccountActionQueue<QueueConfig>
>(TYPES.UserAccountActionQueue);
const projectsFrictionService = diContainer.get<ProjectsFrictionService>(
  TYPES.ProjectsFrictionService
);

function logError(op: string, qMessage: object, e: unknown): Promise<void> {
  const { name, message: errMsg, stack } = e as Error;
  logger.error({
    op,
    message: { qMessage, error: { name, message: errMsg, stack } },
  });
  return Promise.reject(e);
}

for (let i = 0; i < SIMULTANEOUS_QUEUE_COUNT; i++) {
  let onMessage = async (message: BatchTaskMessage) => {
    try {
      await batchActionService.processTask(message);
    } catch (e) {
      return logError("BATCH_PROCESS_FAILURE", message, e);
    }
  };
  onMessage = tracer.wrap(
    "sqs.message_received",
    { resource: "batch_task_processor" },
    onMessage
  );
  const consumer = batchTaskQueue.createQueueConsumer(onMessage);
  consumer.start();
}

for (let i = 0; i < SIMULTANEOUS_QUEUE_COUNT; i++) {
  let onMessage = async (message: UserAccountActionMessage) => {
    try {
      // TODO: Delete the below debug log
      logger.debug({
        op: "USER_ACCOUNT_DELETION",
        msg: "Message received",
        additionalInfo: { message, typeOfMessage: typeof message },
      });
      switch (message.action) {
        case UserAccountActionType.DELETE:
          await userService.deleteAccount(message.userId);
          break;
        case UserAccountActionType.CREATE_DELETION_PLANS:
          await projectsFrictionService.createDeletionPlansForInactiveUsers(
            message.date
          );
          break;
        case UserAccountActionType.DELETE_FREE_RESOURCES:
          await projectsFrictionService.executeScheduledDeletionPlans(
            message.date
          );
          break;
        case UserAccountActionType.REVENUE_CAT_SYNC:
          await subscriptionService.fetchAndUpdateUserEntitlementsCache(
            message.userId
          );
          break;
        default:
          logger.error({
            op: "INVALID_USER_ACCOUNT_ACTION",
            message,
          });
      }
    } catch (e: unknown) {
      return logError("USER_ACCOUNT_ACTION_FAILURE", message, e);
    }
  };
  onMessage = tracer.wrap(
    "sqs.message_received",
    { resource: "user_account_action_processor" },
    onMessage
  );
  const consumer = userAccountActionQueue.createQueueConsumer(onMessage);
  consumer.start();
}

for (let i = 0; i < SIMULTANEOUS_QUEUE_COUNT; i++) {
  let onMessage = async (message: ImageUploadMessage) => {
    try {
      await uploadService.processTrigger(message);
    } catch (e: unknown) {
      return logError("IMAGE_UPLOAD_TRIGGER_PROCESS_FAILURE", message, e);
    }
  };
  onMessage = tracer.wrap(
    "sqs.message_received",
    { resource: "upload_trigger_processor" },
    onMessage
  );
  const consumer = uploadEventQueue.createQueueConsumer(onMessage);
  consumer.start();
}

process.stdin.resume();
