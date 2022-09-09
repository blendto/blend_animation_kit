abstract class Queue<T extends QueueMessage> {
  abstract writeMessage(message: T): Promise<any>;

  abstract createQueueConsumer(
    onMessage: (message: T) => Promise<void>
  ): QueueConsumer;
}

export abstract class QueueMessage {}

export abstract class QueueProvider<C extends QueueConfig> {
  abstract writeToQueue(queueConfig: C, data: any): Promise<any>;

  abstract createQueueConsumer(
    queueConfig: C,
    onMessage: (message: any) => Promise<void>
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

  writeMessage(message: M): Promise<any> {
    return this.queueProvider.writeToQueue(this.config, message);
  }

  createQueueConsumer(onMessage: (message: M) => Promise<void>): QueueConsumer {
    return this.queueProvider.createQueueConsumer(this.config, onMessage);
  }
}
