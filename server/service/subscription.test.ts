import { diContainer } from "inversify.config";
import { AxiosError } from "axios";
import { TYPES } from "server/types";
import SubscriptionService, { NoWatermarkReason } from "./subscription";

describe("SubscriptionService", () => {
  const subscriptionService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );
  const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const blendId = "sqPJ2pRiNeMtfOO7dH5UhLKQbah3";
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
  const creditServiceActivityLogId = "08894d85-ce8b-49db-993d-4c6e47170d13";

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
      jest
        .spyOn(subscriptionService.httpClient, "get")
        .mockRejectedValueOnce(axiosErr);
      jest.spyOn(subscriptionService.httpClient, "post").mockResolvedValueOnce({
        data: subscriptionRes,
        status: 201,
      });

      const res = await subscriptionService.getOrCreate(userId);
      expect(res).toMatchObject(transformedRes);
    });

    it("Retrieves subscription for the user if existent", async () => {
      jest.spyOn(subscriptionService.httpClient, "get").mockResolvedValueOnce({
        data: subscriptionRes,
        status: 200,
      });

      const res = await subscriptionService.getOrCreate(userId);
      expect(res).toMatchObject(transformedRes);
    });
  });

  describe("Check if user can export free of watermark", () => {
    it("Returns true if build is old", async () => {
      jest
        .spyOn(subscriptionService, "getWaterMarkBuildVersion")
        .mockReturnValueOnce(282);

      const res = await subscriptionService.canDoWatermarkFreeExport(
        281,
        userId,
        blendId
      );
      expect(res).toMatchObject({
        can: true,
        noWatermarkReason: NoWatermarkReason.VERSION_IS_OLD,
      });
    });

    it("Returns true if the user has revenue cat entitlement", async () => {
      jest
        .spyOn(subscriptionService, "getWaterMarkBuildVersion")
        .mockReturnValueOnce(282);
      jest
        .spyOn(subscriptionService, "hasRevenueCatHDExportEntitlement")
        .mockResolvedValueOnce(true);

      const res = await subscriptionService.canDoWatermarkFreeExport(
        282,
        userId,
        blendId
      );
      expect(res).toMatchObject({
        can: true,
        noWatermarkReason: NoWatermarkReason.USER_IS_PRO,
      });
    });

    it("Returns true and activity log id if there are enough credits", async () => {
      jest
        .spyOn(subscriptionService, "getWaterMarkBuildVersion")
        .mockReturnValueOnce(282);
      jest
        .spyOn(subscriptionService, "hasRevenueCatHDExportEntitlement")
        .mockResolvedValueOnce(false);
      jest.spyOn(subscriptionService.httpClient, "post").mockResolvedValueOnce({
        data: { creditServiceActivityLogId },
        status: 200,
      });

      const res = await subscriptionService.canDoWatermarkFreeExport(
        282,
        userId,
        blendId
      );
      expect(res).toMatchObject({
        can: true,
        noWatermarkReason: NoWatermarkReason.USER_HAS_CREDITS,
        creditServiceActivityLogId,
      });
    });

    it("Returns false if none of the above are true", async () => {
      jest
        .spyOn(subscriptionService, "getWaterMarkBuildVersion")
        .mockReturnValueOnce(282);
      jest
        .spyOn(subscriptionService, "hasRevenueCatHDExportEntitlement")
        .mockResolvedValueOnce(false);
      const axiosResData = { message: "Expired/Insufficient credits" };
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
      jest
        .spyOn(subscriptionService.httpClient, "post")
        .mockRejectedValueOnce(axiosErr);

      const res = await subscriptionService.canDoWatermarkFreeExport(
        282,
        userId,
        blendId
      );
      expect(res).toMatchObject({ can: false });
    });
  });
});
