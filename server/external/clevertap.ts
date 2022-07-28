import cleverTap, { CleverTap } from "server/typecast/clevertap";
import { injectable } from "inversify";
import ConfigProvider from "server/base/ConfigProvider";

export enum CleverTapEventName {
  SUCCESSFUL_REFERRAL = "successful_referral",
}

@injectable()
export default class CleverTapService {
  client: CleverTap;

  getClient(): CleverTap {
    if (!this.client) {
      this.client = cleverTap.init(
        ConfigProvider.CLEVERTAP_ACCOUNT_ID,
        ConfigProvider.CLEVERTAP_PASSCODE,
        cleverTap.REGIONS.EUROPE
      );
    }
    return this.client;
  }

  async registerEvent(
    userId: string,
    evtName: CleverTapEventName,
    evtData: Record<string, unknown>,
    batchSize = 1,
    debug = 1
  ) {
    await this.getClient().upload(
      [
        {
          type: "event",
          identity: userId,
          ts: Math.floor(Date.now() / 1000),
          evtName,
          evtData,
        },
      ],
      { batchSize, debug }
    );
  }
}
