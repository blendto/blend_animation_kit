import {
  Queue,
  QueueConfig,
  QueueConsumer,
  QueueProvider,
} from "server/external/queue/index";
import { ImageUploadMessage } from "server/base/models/queue-messages";
import { SqsQueueConfig } from "server/external/queue/sqs";
import ConfigProvider from "server/base/ConfigProvider";

export class ImageUploadEventQueue<C extends QueueConfig>
  implements Queue<ImageUploadMessage>
{
  queueProvider: QueueProvider<C>;
  config: C;
  constructor(queueProvider: QueueProvider<C>, config: C) {
    this.queueProvider = queueProvider;
    this.config = config;
  }

  writeMessage(message: ImageUploadMessage): Promise<any> {
    return this.queueProvider.writeToQueue(this.config, message);
  }

  createQueueConsumer(
    onMessage: (message: ImageUploadMessage) => Promise<void>
  ): QueueConsumer {
    return this.queueProvider.createQueueConsumer(this.config, onMessage);
  }
}

export class ImageUploadSqsConfig extends SqsQueueConfig {
  getQueueUrl() {
    return ConfigProvider.UPLOADS_EVENT_QUEUE_URL;
  }
}
