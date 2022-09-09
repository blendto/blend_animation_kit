import { BaseQueue, QueueConfig } from "server/external/queue/index";
import { UserAccountActionMessage } from "server/base/models/queue-messages";
import { SqsQueueConfig } from "server/external/queue/sqs";
import ConfigProvider from "server/base/ConfigProvider";

export class UserAccountActionQueue<C extends QueueConfig> extends BaseQueue<
  C,
  UserAccountActionMessage
> {}

export class UserAccountActionSqsConfig extends SqsQueueConfig {
  getQueueUrl() {
    return ConfigProvider.USER_ACCOUNT_ACTION_QUEUE_URL;
  }
}
