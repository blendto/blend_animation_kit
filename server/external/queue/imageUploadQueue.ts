import { BaseQueue, QueueConfig } from "server/external/queue/index";
import { ImageUploadMessage } from "server/base/models/queue-messages";
import { SqsQueueConfig } from "server/external/queue/sqs";
import ConfigProvider from "server/base/ConfigProvider";

export class ImageUploadEventQueue<C extends QueueConfig> extends BaseQueue<
  C,
  ImageUploadMessage
> {}

export class ImageUploadSqsConfig extends SqsQueueConfig {
  getQueueUrl() {
    return ConfigProvider.UPLOADS_EVENT_QUEUE_URL;
  }
}
