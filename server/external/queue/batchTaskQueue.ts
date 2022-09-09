import { BaseQueue, QueueConfig } from "server/external/queue/index";
import { BatchTaskMessage } from "server/base/models/queue-messages";
import { SqsQueueConfig } from "server/external/queue/sqs";
import ConfigProvider from "server/base/ConfigProvider";

export class BatchTaskQueue<C extends QueueConfig> extends BaseQueue<
  C,
  BatchTaskMessage
> {}

export class BatchTaskSqsConfig extends SqsQueueConfig {
  getQueueUrl() {
    return ConfigProvider.BATCH_TASK_QUEUE_URL;
  }
}
