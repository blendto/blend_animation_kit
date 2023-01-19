import { diContainer } from "inversify.config";
import { AxiosError } from "axios";
import { TYPES } from "server/types";
import { BlendStatus } from "server/base/models/blend";
import SubscriptionService, { NoWatermarkReason } from "./subscription";
import { BlendService } from "./blend";

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

  describe("Get", () => {
    it("Fetches the subscription", async () => {
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
        data: { activityLogId: creditServiceActivityLogId },
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

  describe("getLedger", () => {
    it("Returns coins ledger for the user", async () => {
      jest
        .spyOn(subscriptionService.creditServiceApi, "fetchActivityLogs")
        .mockResolvedValueOnce({
          items: [
            {
              activity: "ADD_CREDITS",
              apiKeyId: "",
              doneAt: 1659445509,
              doneBy: "INTERNAL_USER",
              id: "8537c983-1922-466d-8ec0-add4857c9a30",
              metadata: { reason: "REFEREE_REWARD" },
              postStateOfSubscription: {
                adhocCredits: 25,
                expiry: 1690195350,
                id: "feb51503-5468-4211-869c-15927fcc3ecd",
                planCredits: 9,
                planId: "a09af372-7884-442b-a5da-da3c4a0420c9",
                renewedAt: 1658659350,
                source: "firebase",
                sourceAndSubject: "firebase/r549ddrov3RzN0stZXkrF8KDtmR2",
                subject: "r549ddrov3RzN0stZXkrF8KDtmR2",
                subscribedAt: 1658659350,
                updatedAt: 1659445509,
              },
              preStateOfSubscription: null,
              reversalOf: "",
              reversed: false,
              subscriptionId: "feb51503-5468-4211-869c-15927fcc3ecd",
              subscriptionIdAndActivity:
                "feb51503-5468-4211-869c-15927fcc3ecd/ADD_CREDITS",
              transactionTypeId: "",
              updateExpression: [
                { key: "updatedAt", kind: "SET", value: 1659445509 },
                { key: "adhocCredits", kind: "ADD", value: 5 },
              ],
            },
            {
              activity: "ADD_CREDITS",
              apiKeyId: "",
              doneAt: 1659444595,
              doneBy: "INTERNAL_USER",
              id: "503424a2-aaef-4ff7-8ad3-4788ea822337",
              metadata: { reason: "PURCHASE" },
              postStateOfSubscription: {
                adhocCredits: 20,
                expiry: 1690195350,
                id: "feb51503-5468-4211-869c-15927fcc3ecd",
                planCredits: 9,
                planId: "a09af372-7884-442b-a5da-da3c4a0420c9",
                renewedAt: 1658659350,
                source: "firebase",
                sourceAndSubject: "firebase/r549ddrov3RzN0stZXkrF8KDtmR2",
                subject: "r549ddrov3RzN0stZXkrF8KDtmR2",
                subscribedAt: 1658659350,
                updatedAt: 1659444595,
              },
              preStateOfSubscription: null,
              reversalOf: "",
              reversed: false,
              subscriptionId: "feb51503-5468-4211-869c-15927fcc3ecd",
              subscriptionIdAndActivity:
                "feb51503-5468-4211-869c-15927fcc3ecd/ADD_CREDITS",
              transactionTypeId: "",
              updateExpression: [
                { key: "updatedAt", kind: "SET", value: 1659444595 },
                { key: "adhocCredits", kind: "ADD", value: 20 },
              ],
            },
            {
              activity: "TRANSACT",
              apiKeyId: "",
              doneAt: 1658659456,
              doneBy: "INTERNAL_USER",
              id: "bf5709a3-3878-4c61-a67e-e14f3223b00c",
              metadata: { blendId: "SvD1o7L0" },
              postStateOfSubscription: null,
              preStateOfSubscription: {
                adhocCredits: 0,
                expiry: 1690195350,
                id: "feb51503-5468-4211-869c-15927fcc3ecd",
                planCredits: 10,
                planId: "a09af372-7884-442b-a5da-da3c4a0420c9",
                renewedAt: 1658659350,
                source: "firebase",
                sourceAndSubject: "firebase/r549ddrov3RzN0stZXkrF8KDtmR2",
                subject: "r549ddrov3RzN0stZXkrF8KDtmR2",
                subscribedAt: 1658659350,
                updatedAt: 1658659350,
              },
              reversalOf: "",
              reversed: false,
              subscriptionId: "feb51503-5468-4211-869c-15927fcc3ecd",
              subscriptionIdAndActivity:
                "feb51503-5468-4211-869c-15927fcc3ecd/TRANSACT",
              transactionTypeId: "878ca033-f96a-413c-92e1-7dc098b2a8b7",
              updateExpression: [
                { key: "updatedAt", kind: "SET", value: 1658659456 },
                { key: "planCredits", kind: "ADD", value: -1 },
              ],
            },
            {
              activity: "SUBSCRIBE",
              apiKeyId: "",
              doneAt: 1658659350,
              doneBy: "INTERNAL_USER",
              id: "0d5ea70b-1902-426c-8679-477011265596",
              metadata: null,
              postStateOfSubscription: {
                adhocCredits: 0,
                expiry: 1690195350,
                id: "feb51503-5468-4211-869c-15927fcc3ecd",
                planCredits: 10,
                planId: "a09af372-7884-442b-a5da-da3c4a0420c9",
                renewedAt: 1658659350,
                source: "firebase",
                sourceAndSubject: "firebase/r549ddrov3RzN0stZXkrF8KDtmR2",
                subject: "r549ddrov3RzN0stZXkrF8KDtmR2",
                subscribedAt: 1658659350,
                updatedAt: 1658659350,
              },
              preStateOfSubscription: null,
              reversalOf: "",
              reversed: false,
              subscriptionId: "feb51503-5468-4211-869c-15927fcc3ecd",
              subscriptionIdAndActivity:
                "feb51503-5468-4211-869c-15927fcc3ecd/SUBSCRIBE",
              transactionTypeId: "",
              updateExpression: null,
            },
          ],
          lastItemDoneAt: 0,
          lastItemId: "",
        });

      jest
        .spyOn(
          diContainer.get<BlendService>(TYPES.BlendService),
          "getMinimalBlends"
        )
        .mockResolvedValueOnce([
          {
            createdAt: 1658659402423,
            id: "SvD1o7L0",
            output: {
              image: {
                resolution: { width: 2160, height: 2160 },
                path: "SvD1o7L0/image-1658659464.jpg",
              },
              thumbnail: {
                resolution: { width: 2160, height: 2160 },
                path: "SvD1o7L0/thumbnail-1658659464.jpg",
              },
              video: {
                resolution: { width: 1080, height: 1080 },
                path: "SvD1o7L0/output-1658659464.mp4",
              },
            },
            updatedAt: 1658659457483,
            status: BlendStatus.Generated,
          },
        ]);

      expect(await subscriptionService.getLedger(userId)).toMatchObject({
        items: [
          {
            activity: "REFEREE_REWARD",
            doneAt: 1659445509,
            coinsCount: 5,
          },
          {
            activity: "PURCHASE",
            doneAt: 1659444595,
            coinsCount: 20,
          },
          {
            activity: "WATERMARK_FREE_EXPORT",
            doneAt: 1658659456,
            blend: {
              createdAt: 1658659402423,
              id: "SvD1o7L0",
              output: {
                image: {
                  resolution: {
                    width: 2160,
                    height: 2160,
                  },
                  path: "SvD1o7L0/image-1658659464.jpg",
                },
                thumbnail: {
                  resolution: {
                    width: 2160,
                    height: 2160,
                  },
                  path: "SvD1o7L0/thumbnail-1658659464.jpg",
                },
                video: {
                  resolution: {
                    width: 1080,
                    height: 1080,
                  },
                  path: "SvD1o7L0/output-1658659464.mp4",
                },
              },
              updatedAt: 1658659457483,
              status: "GENERATED",
            },
            coinsCount: -1,
          },
          {
            activity: "WELCOME_REWARD",
            doneAt: 1658659350,
            coinsCount: 10,
          },
        ],
      });
    });
  });
});
