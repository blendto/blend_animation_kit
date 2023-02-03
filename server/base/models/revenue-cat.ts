export enum Entitlement {
  BRANDING = "BRANDING",
  BATCH_EDIT = "BATCH_EDIT",
  HD_EXPORT = "HD_EXPORT",
}

export type Entitlements = {
  [attribute in Entitlement]?: {
    expires_date: string;
  };
};

export type FetchEntitlementResponse = {
  entitlements: string[];
  expiry: number;
};
