/* eslint-disable camelcase */

type TransferEventRequest = {
  transferred_from: string[];
  transferred_to: string[];
};

type DefaultEventRequest = {
  app_user_id: string;
  entitlement_ids?: string[];
  aliases: string[];
  expiration_at_ms: number;
};

export abstract class RevenueCatEvent {
  private static DEFAULT_RC_EVENTS = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "CANCELLATION",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "EXPIRATION",
  ];

  static from(request: Record<string, unknown>): RevenueCatEvent {
    const { event } = request as { event: { type: string } };

    if (event.type === "TRANSFER") {
      return new RCTransferEvent(event as unknown as TransferEventRequest);
    }
    if (this.DEFAULT_RC_EVENTS.includes(event.type)) {
      return new RCDefaultEvent(event as unknown as DefaultEventRequest);
    }
    return null;
  }

  extractUserId(aliases: string[]): string {
    return aliases.find((id) => this.isUserIdValid(id));
  }

  isUserIdValid(userId: string): boolean {
    return !userId.startsWith("$RCAnonymousID");
  }
}

export class RCTransferEvent extends RevenueCatEvent {
  transferredFrom: string[];
  transferredTo: string[];

  constructor(event: TransferEventRequest) {
    super();
    this.transferredFrom = event.transferred_from;
    this.transferredTo = event.transferred_to;
  }

  getTransferDetails(): { from: string; to: string } {
    return {
      from: this.extractUserId(this.transferredFrom),
      to: this.extractUserId(this.transferredTo),
    };
  }
}

export class RCDefaultEvent extends RevenueCatEvent {
  userId: string;
  aliases: string[];

  constructor(event: DefaultEventRequest) {
    super();
    this.userId = event.app_user_id;
    this.aliases = event.aliases;
  }

  getUpdateDetails(): {
    userId: string;
  } {
    const userId = this.isUserIdValid(this.userId)
      ? this.userId
      : this.extractUserId(this.aliases);

    return { userId };
  }
}
