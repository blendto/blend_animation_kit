export enum Entitlement {
  PRO = "PRO",
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
