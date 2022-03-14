import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import BrandingService, {
  validUpdateOperations,
  validUpdatePaths,
} from "server/service/branding";
import ModelHelper from "server/models/helper";
import {
  brandingStatus,
  BrandingDocument,
  BrandingModel,
  brandingLogoStatus,
} from "server/models/branding";
import { UserError } from "server/base/errors";

describe("BrandingService", () => {
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const id = "wNALVbEj";
  const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const updatedAt = 1646906641;
  const status = brandingStatus.CREATED;
  const brandingDoc: BrandingDocument = {
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
      const querySpy = jest
        .spyOn(brandingService.model, "query")
        .mockReturnValueOnce({
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
      const querySpy = jest
        .spyOn(brandingService.model, "query")
        .mockReturnValueOnce({
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

  describe("Update", () => {
    it("Rejects primary logo update if logo list is empty", async () => {
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDoc);

      await expect(
        brandingService.update(userId, [
          {
            op: validUpdateOperations.add,
            path: validUpdatePaths.primaryLogo,
            value: "SOME-KEY",
          },
        ])
      ).rejects.toThrow(
        new UserError("Primary logo is pointing to an invalid file key")
      );
      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);
    });

    it("Rejects primary logo update if it points to a un-uploaded key", async () => {
      const currentPrimaryKey = "PRIMARY-FILE-KEY";
      const unUploadedKey = "NON-UPLOADED-KEY";
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: currentPrimaryKey,
          entries: [
            {
              fileKey: currentPrimaryKey,
              status: brandingLogoStatus.UPLOADED,
            },
            {
              fileKey: unUploadedKey,
              status: brandingLogoStatus.INITIALIZED,
            },
          ],
        },
      };
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);

      await expect(
        brandingService.update(userId, [
          {
            op: validUpdateOperations.add,
            path: validUpdatePaths.primaryLogo,
            value: unUploadedKey,
          },
        ])
      ).rejects.toThrow(
        new UserError("Primary logo is pointing to an invalid file key")
      );
      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);
    });

    it("Rejects primary logo update if it points to a non-existent key", async () => {
      const currentPrimaryKey = "PRIMARY-FILE-KEY";
      const nonExistentKey = "NON-EXISTENT-KEY";
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: currentPrimaryKey,
          entries: [
            {
              fileKey: currentPrimaryKey,
              status: brandingLogoStatus.UPLOADED,
            },
          ],
        },
      };
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);

      await expect(
        brandingService.update(userId, [
          {
            op: validUpdateOperations.add,
            path: validUpdatePaths.primaryLogo,
            value: nonExistentKey,
          },
        ])
      ).rejects.toThrow(
        new UserError("Primary logo is pointing to an invalid file key")
      );
      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);
    });

    it("Updates primary logo if it points to a valid key", async () => {
      const currentPrimaryKey = "PRIMARY-FILE-KEY";
      const anotherValidKey = "VALID-KEY";
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: currentPrimaryKey,
          entries: [
            {
              fileKey: currentPrimaryKey,
              status: brandingLogoStatus.UPLOADED,
            },
            {
              fileKey: anotherValidKey,
              status: brandingLogoStatus.UPLOADED,
            },
          ],
        },
      };
      const updatedBrandingDoc: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: anotherValidKey,
          entries: [
            {
              fileKey: currentPrimaryKey,
              status: brandingLogoStatus.UPLOADED,
            },
            {
              fileKey: anotherValidKey,
              status: brandingLogoStatus.UPLOADED,
            },
          ],
        },
      };
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const modelUpdateMock = jest
        .spyOn(brandingService.model, "update")
        .mockResolvedValueOnce(updatedBrandingDoc);

      const res = await brandingService.update(userId, [
        {
          op: validUpdateOperations.add,
          path: validUpdatePaths.primaryLogo,
          value: anotherValidKey,
        },
      ]);
      expect(res).toMatchObject(updatedBrandingDoc);

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);

      expect(modelUpdateMock.mock.calls.length).toBe(1);
      expect(modelUpdateMock.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {
            logos: updatedBrandingDoc.logos,
          },
          $REMOVE: [],
        },
      ]);
    });

    it("Rejects unsetting primary logo", async () => {
      const primaryKey = "PRIMARY-FILE-KEY";
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: primaryKey,
          entries: [
            {
              fileKey: primaryKey,
              status: brandingLogoStatus.UPLOADED,
            },
          ],
        },
      };
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);

      await expect(
        brandingService.update(userId, [
          {
            op: validUpdateOperations.remove,
            path: validUpdatePaths.primaryLogo,
          },
        ])
      ).rejects.toThrow(new UserError("Primary logo pointer can't be unset"));

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);
    });

    it("Supports unsetting other attributes", async () => {
      const email = "engg@blend.to";
      const whatsappNo = "+91 999 999 9991@blend.to";
      const brandingDocWithOtherAttrs: BrandingDocument = {
        ...brandingDoc,
        email,
        whatsappNo,
      };
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithOtherAttrs);
      const modelUpdateMock = jest
        .spyOn(brandingService.model, "update")
        .mockResolvedValueOnce(brandingDoc);

      const res = await brandingService.update(userId, [
        {
          op: validUpdateOperations.remove,
          path: validUpdatePaths.email,
        },
        {
          op: validUpdateOperations.remove,
          path: validUpdatePaths.whatsappNo,
        },
      ]);
      expect(res).toMatchObject(brandingDoc);

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);

      expect(modelUpdateMock.mock.calls.length).toBe(1);
      expect(modelUpdateMock.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {},
          $REMOVE: [validUpdatePaths.email, validUpdatePaths.whatsappNo],
        },
      ]);
    });
  });
});
