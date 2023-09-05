abstract class Queue<T extends QueueMessage> {
  abstract writeMessage(
    message: T,
    messageAttributes?: { [key: string]: string }
  ): Promise<unknown>;

  abstract createQueueConsumer(
    onMessage: (message: T) => Promise<void>
  ): QueueConsumer;
}

export abstract class QueueMessage {}

export abstract class QueueProvider<C extends QueueConfig> {
  abstract writeToQueue(
    queueConfig: C,
    data: unknown,
    messageAttributes?: { [key: string]: string }
  ): Promise<unknown>;

  abstract writeMultipleToQueue(
    queueConfig: C,
    entries: unknown[]
  ): Promise<void>;

  abstract createQueueConsumer(
    queueConfig: C,
    onMessage: (message: unknown) => Promise<void>
  ): QueueConsumer;
}

export abstract class QueueConfig {}

export abstract class QueueConsumer {
  abstract start(): void;
  abstract stop(): void;
}

export class BaseQueue<C extends QueueConfig, M extends QueueMessage>
  implements Queue<M>
{
  queueProvider: QueueProvider<C>;
  config: C;
  constructor(queueProvider: QueueProvider<C>, config: C) {
    this.queueProvider = queueProvider;
    this.config = config;
  }

  writeMessage(
    message: M,
    attributes?: { [key: string]: string }
  ): Promise<unknown> {
    return this.queueProvider.writeToQueue(this.config, message, attributes);
  }

  writeMultipleMessages(
    entries: {
      id: string;
      message: M;
      attributes?: { [key: string]: string };
    }[]
  ): Promise<void> {
    return this.queueProvider.writeMultipleToQueue(this.config, entries);
  }

  createQueueConsumer(onMessage: (message: M) => Promise<void>): QueueConsumer {
    return this.queueProvider.createQueueConsumer(this.config, onMessage);
  }
}
