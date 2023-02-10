/* eslint-disable camelcase */
import { readFileSync } from "fs";
import {
  RCDefaultEvent,
  RCTransferEvent,
  RevenueCatEvent,
} from "server/engine/webhook/revenue-cat-event";

describe("should process revenue cat webhook events", () => {
  it("correct details are generated for default events", () => {
    const events = JSON.parse(
      readFileSync(
        "__tests__/resources/revenue-cat/sample-default-events.json",
        "utf8"
      )
    ) as Record<string, unknown>[];
    events.forEach((req) => {
      const event = RevenueCatEvent.from(req);
      expect(event).toBeInstanceOf(RCDefaultEvent);
      const details = (event as RCDefaultEvent).getUpdateDetails();
      const { app_user_id } = req.event as { app_user_id: string };
      expect(details.userId).toBe(app_user_id);
    });
  });

  it("correct details are generated for transfer event", () => {
    const req = JSON.parse(
      readFileSync(
        "__tests__/resources/revenue-cat/sample-transfer-event.json",
        "utf8"
      )
    ) as Record<string, unknown>;
    const event = RevenueCatEvent.from(req);
    expect(event).toBeInstanceOf(RCTransferEvent);
    const { from, to } = (event as RCTransferEvent).getTransferDetails();

    expect(event.isUserIdValid(from)).toBeTruthy();
    expect(event.isUserIdValid(to)).toBeTruthy();
  });

  it("unsupported event is not recognised", () => {
    const req = JSON.parse(
      readFileSync(
        "__tests__/resources/revenue-cat/sample-unsupported-event.json",
        "utf8"
      )
    ) as Record<string, unknown>;
    const event = RevenueCatEvent.from(req);
    expect(event).toBeNull();
  });

  it("faulty app_user_id is skipped from default event update details", () => {
    const req = JSON.parse(
      readFileSync(
        "__tests__/resources/revenue-cat/faulty-default-event-non-anonymous-id-missing.json",
        "utf8"
      )
    ) as Record<string, unknown>;

    const event = RevenueCatEvent.from(req);
    expect(event).toBeInstanceOf(RCDefaultEvent);

    const { userId } = (event as RCDefaultEvent).getUpdateDetails();
    expect(userId).toBeUndefined();
  });
});
