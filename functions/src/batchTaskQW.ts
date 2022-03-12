import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BatchTaskQueue } from "server/external/queue/batchTaskQueue";
import { QueueConfig } from "server/external/queue";
import { BatchActionService } from "server/service/queue/batch/batchAction";
import { UploadService } from "server/service/queue/upload";
import { BlendImageUploadEventQueue } from "server/external/queue/blendImageUploadQueue";

const batchActionService = diContainer.get<BatchActionService>(
  TYPES.BatchActionService
);
const batchTaskQueue = diContainer.get<BatchTaskQueue<QueueConfig>>(
  TYPES.BatchTaskQueue
);
const uploadService = diContainer.get<UploadService>(TYPES.UploadService);
const uploadEventQueue = diContainer.get<
  BlendImageUploadEventQueue<QueueConfig>
>(TYPES.BlendImageUploadEventQueue);

const batchTaskQueueConsumer = batchTaskQueue.createQueueConsumer(
  async (message) => {
    try {
      console.info({ op: "PROCESSING_BATCH_TASK", message: message });
      await batchActionService.processTask(message);
    } catch (e) {
      console.error({ message: message, error: e });
      return Promise.reject(e);
    }
  }
);

const uploadQueueConsumer = uploadEventQueue.createQueueConsumer(
  async (message) => {
    const bucket = message.Records[0].s3.bucket.name;
    const fileKey = decodeURIComponent(
      message.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    try {
      console.info({ op: "PROCESSING_IMAGE_UPLOAD_TASK", message: message });
      await uploadService.processHeroImageTrigger(bucket, fileKey);
    } catch (e) {
      console.error({ message: message, error: e });
      return Promise.reject(e);
    }
  }
);

batchTaskQueueConsumer.start();
uploadQueueConsumer.start();

process.stdin.resume();
