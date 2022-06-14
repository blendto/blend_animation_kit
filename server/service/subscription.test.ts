import { diContainer } from "inversify.config";
import { AxiosError } from "axios";
import ConfigProvider from "server/base/ConfigProvider";
import { TYPES } from "server/types";
import SubscriptionService from "./subscription";

describe("SubscriptionService", () => {
  const subscriptionService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );
  const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const subscriptionRes = {
    adhocCredits: 0,
    expiry: 1686674064,
    id: "f5ccd8e3-06b5-4601-97f7-6c59a59331ae",
    planCredits: 10,
    planId: "a09af372-7884-442b-a5da-da3c4a0420c9",
    renewedAt: 1655138064,
    source: "firebase",
    sourceAndSubject: `firebase/${userId}`,
    subject: userId,
    subscribedAt: 1655138064,
    updatedAt: 1655138064,
  };
  const transformedRes = {
    adhocCredits: 0,
    planCredits: 10,
    expiry: 1686674064,
    updatedAt: 1655138064,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Get or create", () => {
    it("Creates subscription for the user if non-existent", async () => {
      const axiosResData = { message: "Subscription not found" };
      const axiosErr: AxiosError = {
        name: "",
        message: "",
        config: {},
        response: {
          data: axiosResData,
          status: 400,
          statusText: "BAD_REQUEST",
          headers: {},
          config: {},
        },
        isAxiosError: true,
        toJSON: () => axiosResData,
      };
      const getSpy = jest
        .spyOn(subscriptionService.httpClient, "get")
        .mockRejectedValueOnce(axiosErr);
      const createSpy = jest
        .spyOn(subscriptionService.httpClient, "post")
        .mockResolvedValueOnce({
          data: subscriptionRes,
          status: 201,
        });

      const res = await subscriptionService.getOrCreate(userId);
      expect(res).toMatchObject(transformedRes);

      expect(getSpy.mock.calls.length).toBe(1);
      expect(getSpy.mock.calls[0]).toMatchObject([
        `/v1/subscriptions?source=firebase&subject=${userId}`,
      ]);

      expect(createSpy.mock.calls.length).toBe(1);
      expect(createSpy.mock.calls[0]).toMatchObject([
        "/v1/subscriptions",
        {
          source: "firebase",
          subject: userId,
          planId: ConfigProvider.CREDIT_SERVICE_PLAN_ID,
        },
      ]);
    });

    it("Retrieves subscription for the user if existent", async () => {
      const getSpy = jest
        .spyOn(subscriptionService.httpClient, "get")
        .mockResolvedValueOnce({
          data: subscriptionRes,
          status: 200,
        });

      const res = await subscriptionService.getOrCreate(userId);
      expect(res).toMatchObject(transformedRes);

      expect(getSpy.mock.calls.length).toBe(1);
      expect(getSpy.mock.calls[0]).toMatchObject([
        `/v1/subscriptions?source=firebase&subject=${userId}`,
      ]);
    });
  });
});
