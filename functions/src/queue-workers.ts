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
  BatchTaskMessage,
  ImageUploadMessage,
} from "server/base/models/queue-messages";

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

function logMessage(op: string, qMessage: object) {
  logger.info({ op, message: { qMessage } });
}

function logError(op: string, qMessage: object, e: unknown): Promise<void> {
  logger.error({ op, message: { qMessage, error: e as object } });
  return Promise.reject(e);
}

for (let i = 0; i < SIMULTANEOUS_QUEUE_COUNT; i++) {
  let onMessage = async (message: BatchTaskMessage) => {
    try {
      logMessage("PROCESSING_BATCH_TASK", message);
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
  let onMessage = async (message: ImageUploadMessage) => {
    try {
      logMessage("PROCESSING_IMAGE_UPLOAD_TRIGGER", message);
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
