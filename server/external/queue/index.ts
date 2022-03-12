export abstract class Queue<T extends QueueMessage> {
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
