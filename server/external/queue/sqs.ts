import {
  QueueConfig,
  QueueConsumer,
  QueueProvider,
} from "server/external/queue/index";
import AWS from "server/external/aws";
import { Consumer } from "sqs-consumer";
import { SQSMessage } from "sqs-consumer/dist/consumer";

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

export abstract class SqsQueueConfig implements QueueConfig {
  abstract getQueueUrl(): string;
}

export class SqsQueueConsumer implements QueueConsumer {
  private consumer: Consumer;
  constructor(
    queueConfig: SqsQueueConfig,
    onMessage: (message: SQSMessage) => Promise<void>
  ) {
    this.consumer = Consumer.create({
      queueUrl: queueConfig.getQueueUrl(),
      sqs,
      handleMessage: onMessage,
      heartbeatInterval: 60 * 2,
    });
  }

  start() {
    this.consumer.start();
  }

  stop() {
    this.consumer.stop();
  }
}

export class SqsProvider implements QueueProvider<SqsQueueConfig> {
  writeToQueue(queueConfig: SqsQueueConfig, data): Promise<any> {
    return new Promise((resolve, reject) => {
      sqs.sendMessage(
        {
          QueueUrl: queueConfig.getQueueUrl(),
          MessageBody: JSON.stringify(data),
        },
        (err, data) => {
          if (err) {
            return reject(err);
          }
          resolve(data.MessageId);
        }
      );
    });
  }

  createQueueConsumer(
    queueConfig: SqsQueueConfig,
    onMessage: (message: any) => Promise<void>
  ): QueueConsumer {
    return new SqsQueueConsumer(queueConfig, async (sqsMessage: SQSMessage) => {
      await onMessage(JSON.parse(sqsMessage.Body));
    });
  }
}
