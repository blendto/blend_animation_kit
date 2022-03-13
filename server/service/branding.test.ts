import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import BrandingService from "server/service/branding";
import ModelHelper from "server/models/helper";
import { brandingStatus, BrandingModel } from "server/models/branding";

describe("BrandingService", () => {
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const id = "wNALVbEj";
  const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const updatedAt = "2022-03-08T12:33:41.362Z";
  const status = brandingStatus.CREATED;
  const brandingDoc = {
    id,
    userId,
    logos: {
      entries: [],
    },
    updatedAt,
    status,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Get or create", () => {
    it("Creates branding profile for the user if non-existent", async () => {
      const querySpy = jest.spyOn(BrandingModel, "query").mockReturnValueOnce({
        exec: async () => Promise.resolve([]),
      });
      const createSpy = jest
        .spyOn(ModelHelper, "createWithId")
        .mockResolvedValueOnce(brandingDoc);

      const res = await brandingService.getOrCreate(userId);
      expect(res).toMatchObject(brandingDoc);

      expect(querySpy.mock.calls.length).toBe(1);
      expect(querySpy.mock.calls[0]).toMatchObject([{ userId }]);

      expect(createSpy.mock.calls.length).toBe(1);
      expect(createSpy.mock.calls[0]).toMatchObject([
        BrandingModel,
        { userId },
      ]);
    });

    it("Retrieves the branding profile for the user if existent", async () => {
      const querySpy = jest.spyOn(BrandingModel, "query").mockReturnValueOnce({
        exec: async () => Promise.resolve([brandingDoc]),
      });
      const createSpy = jest.spyOn(ModelHelper, "createWithId");

      const res = await brandingService.getOrCreate(userId);
      expect(res).toMatchObject(brandingDoc);

      expect(querySpy.mock.calls.length).toBe(1);
      expect(querySpy.mock.calls[0]).toMatchObject([{ userId }]);

      expect(createSpy.mock.calls.length).toBe(0);
    });
  });
});
