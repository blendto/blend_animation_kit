import cleverTap from "clevertap";

export type CleverTap = {
  upload: (
    data: {
      type: "event" | "profile";
      identity: string;
      ts: number;
      evtName?: string;
      evtData?: Record<string, unknown>;
      profileData?: Record<string, unknown>;
    }[],
    options: {
      debug?: number;
      batchSize?: number;
    }
  ) => Promise<void>;
};

export default cleverTap as {
  init: (accountId: string, passcode: string, region: string) => CleverTap;
  REGIONS: Record<string, string>;
};
