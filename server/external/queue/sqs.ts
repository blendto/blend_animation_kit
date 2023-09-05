import {
  QueueConfig,
  QueueConsumer,
  QueueProvider,
} from "server/external/queue/index";
import AWS from "server/external/aws";
import { Consumer } from "sqs-consumer";
import { SQSMessage } from "sqs-consumer/dist/consumer";
import SQS, { MessageAttributeValue } from "aws-sdk/clients/sqs";
import { isEmpty } from "lodash";

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
      visibilityTimeout: 60 * 5,
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
  writeToQueue(
    queueConfig: SqsQueueConfig,
    message: Record<string, unknown>,
    messageAttributes?: { [key: string]: string }
  ): Promise<unknown> {
    const req: SQS.Types.SendMessageRequest = {
      QueueUrl: queueConfig.getQueueUrl(),
      MessageBody: JSON.stringify(message),
    };
    const { MessageGroupId, MessageDeduplicationId, ...customAttributes } =
      messageAttributes;
    if (MessageGroupId) {
      req.MessageGroupId = MessageGroupId;
    }
    if (MessageDeduplicationId) {
      req.MessageDeduplicationId = MessageDeduplicationId;
    }
    if (!isEmpty(customAttributes)) {
      req.MessageAttributes = this.sqsMessageAttributes(customAttributes);
    }
    return new Promise((resolve, reject) => {
      sqs.sendMessage(req, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data.MessageId);
      });
    });
  }

  private sqsMessageAttributes(messageAttributes: { [key: string]: string }) {
    const sqsMessageAttributes: { [key: string]: MessageAttributeValue } = {};
    Object.entries(messageAttributes).forEach(([key, val]) => {
      sqsMessageAttributes[key] = { DataType: "String", StringValue: val };
    });
    return sqsMessageAttributes;
  }

  createQueueConsumer(
    queueConfig: SqsQueueConfig,
    onMessage: (message: unknown) => Promise<void>
  ): QueueConsumer {
    return new SqsQueueConsumer(queueConfig, async (sqsMessage: SQSMessage) => {
      await onMessage(JSON.parse(sqsMessage.Body));
    });
  }

  async writeMultipleToQueue(
    queueConfig: SqsQueueConfig,
    entries: {
      id: string;
      message: Record<string, unknown>;
      attributes?: { [key: string]: string };
    }[]
  ): Promise<void> {
    if (entries.length > 10) {
      throw new Error("SQS can't send more than 10 messages per batch");
    }
    const req: SQS.Types.SendMessageBatchRequest = {
      QueueUrl: queueConfig.getQueueUrl(),
      Entries: entries.map((e) => {
        const batchEntry: SQS.Types.SendMessageBatchRequestEntry = {
          Id: e.id,
          MessageBody: JSON.stringify(e.message),
        };
        const { MessageGroupId, MessageDeduplicationId, ...customAttributes } =
          e.attributes;
        if (MessageGroupId) {
          batchEntry.MessageGroupId = MessageGroupId;
        }
        if (MessageDeduplicationId) {
          batchEntry.MessageDeduplicationId = MessageDeduplicationId;
        }
        if (!isEmpty(customAttributes)) {
          batchEntry.MessageAttributes =
            this.sqsMessageAttributes(customAttributes);
        }
        return batchEntry;
      }),
    };
    await new Promise((resolve, reject) => {
      sqs.sendMessageBatch(req, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  }
}
