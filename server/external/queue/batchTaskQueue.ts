import {
  Queue,
  QueueConfig,
  QueueConsumer,
  QueueProvider,
} from "server/external/queue/index";
import { BatchTaskMessage } from "server/base/models/queue-messages";
import { SqsQueueConfig } from "server/external/queue/sqs";
import ConfigProvider from "server/base/ConfigProvider";

export class BatchTaskQueue<C extends QueueConfig>
  implements Queue<BatchTaskMessage>
{
  queueProvider: QueueProvider<C>;
  config: C;
  constructor(queueProvider: QueueProvider<C>, config: C) {
    this.queueProvider = queueProvider;
    this.config = config;
  }

  writeMessage(message: BatchTaskMessage): Promise<any> {
    return this.queueProvider.writeToQueue(this.config, message);
  }

  createQueueConsumer(
    onMessage: (message: BatchTaskMessage) => Promise<void>
  ): QueueConsumer {
    return this.queueProvider.createQueueConsumer(this.config, onMessage);
  }
}

export class BatchTaskSqsConfig extends SqsQueueConfig {
  getQueueUrl() {
    return ConfigProvider.BATCH_TASK_QUEUE_URL;
  }
}
