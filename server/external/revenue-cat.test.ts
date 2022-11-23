import { Entitlement, Entitlements, revenueCat } from "./revenue-cat";

function spyOnGetAPI(entitlements: Entitlements) {
  return jest.spyOn(revenueCat.httpClient, "get").mockResolvedValueOnce({
    data: {
      subscriber: {
        entitlements,
      },
    },
  });
}

describe("RevenueCat", () => {
  const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const now = new Date();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("hasEntitlement", () => {
    it.skip("returns false if a user doesn't have the asked entitlement", async () => {
      const getAPISpy = spyOnGetAPI({});

      const res = await revenueCat.hasEntitlement(userId, Entitlement.BRANDING);
      expect(res).toBe(false);

      expect(getAPISpy.mock.calls.length).toBe(1);
      expect(getAPISpy.mock.calls[0]).toMatchObject([
        `/v1/subscribers/${userId}`,
      ]);
    });

    it.skip("returns false if a user has the asked entitlement but as expired", async () => {
      const thirtyMinutesEarlier = new Date(now.getTime() - 30 * 60 * 1000);
      const getAPISpy = spyOnGetAPI({
        [Entitlement.BRANDING]: {
          expires_date: thirtyMinutesEarlier.toISOString(),
        },
      });

      const res = await revenueCat.hasEntitlement(userId, Entitlement.BRANDING);
      expect(res).toBe(false);

      expect(getAPISpy.mock.calls.length).toBe(1);
      expect(getAPISpy.mock.calls[0]).toMatchObject([
        `/v1/subscribers/${userId}`,
      ]);
    });

    it.skip("returns true if a user has the asked entitlement and as not expired", async () => {
      const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
      const getAPISpy = spyOnGetAPI({
        [Entitlement.BRANDING]: {
          expires_date: thirtyMinutesLater.toISOString(),
        },
      });

      const res = await revenueCat.hasEntitlement(userId, Entitlement.BRANDING);
      expect(res).toBe(true);

      expect(getAPISpy.mock.calls.length).toBe(1);
      expect(getAPISpy.mock.calls[0]).toMatchObject([
        `/v1/subscribers/${userId}`,
      ]);
    });
  });
});
