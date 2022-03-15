import { diContainer } from "inversify.config";
import logger from "server/base/Logger";
import { TYPES } from "server/types";
import { BatchTaskQueue } from "server/external/queue/batchTaskQueue";
import { QueueConfig } from "server/external/queue";
import { BatchActionService } from "server/service/queue/batch/batchAction";
import { UploadService } from "server/service/queue/upload";
import { ImageUploadEventQueue } from "server/external/queue/imageUploadQueue";

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

const batchTaskQueueConsumer = batchTaskQueue.createQueueConsumer(
  async (message) => {
    try {
      logger.info({
        op: "PROCESSING_BATCH_TASK",
        message: { qMessage: message },
      });
      await batchActionService.processTask(message);
    } catch (e) {
      logger.error({
        op: "BATCH_PROCESS_FAILURE",
        message: { qMessage: message, error: e as object },
      });
      return Promise.reject(e);
    }
  }
);

const uploadQueueConsumer = uploadEventQueue.createQueueConsumer(
  async (message) => {
    try {
      logger.info({
        op: "PROCESSING_IMAGE_UPLOAD_TRIGGER",
        message: { qMessage: message },
      });
      await uploadService.processTrigger(message);
    } catch (e) {
      logger.error({
        op: "IMAGE_UPLOAD_TRIGGER_PROCESS_FAILURE",
        message: { qMessage: message, error: e as object },
      });
      return Promise.reject(e);
    }
  }
);

batchTaskQueueConsumer.start();
uploadQueueConsumer.start();

process.stdin.resume();
