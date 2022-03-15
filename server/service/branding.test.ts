import ConfigProvider from "server/base/ConfigProvider";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import BrandingService, {
  validUpdateOperations,
  validUpdatePaths,
} from "server/service/branding";
import ModelHelper from "server/models/helper";
import {
  BrandingStatus,
  BrandingDocument,
  BrandingModel,
  BrandingLogoStatus,
} from "server/models/branding";
import { UserError } from "server/base/errors";

describe("BrandingService", () => {
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const id = "wNALVbEj";
  const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const updatedAt = 1646906641;
  const status = BrandingStatus.CREATED;
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
              status: BrandingLogoStatus.UPLOADED,
            },
            {
              fileKey: unUploadedKey,
              status: BrandingLogoStatus.INITIALIZED,
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
              status: BrandingLogoStatus.UPLOADED,
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
              status: BrandingLogoStatus.UPLOADED,
            },
            {
              fileKey: anotherValidKey,
              status: BrandingLogoStatus.UPLOADED,
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
              status: BrandingLogoStatus.UPLOADED,
            },
            {
              fileKey: anotherValidKey,
              status: BrandingLogoStatus.UPLOADED,
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
              status: BrandingLogoStatus.UPLOADED,
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

  describe("Logo initiation", () => {
    it("Rejects request if the profile already already has 3 logos", async () => {
      const primaryKey = "PRIMARY-KEY";
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: primaryKey,
          entries: [
            {
              fileKey: primaryKey,
              status: BrandingLogoStatus.UPLOADED,
            },
            {
              fileKey: "ANOTHER-VALID-KEY",
              status: BrandingLogoStatus.UPLOADED,
            },
            {
              fileKey: "THIRD-VALID-KEY",
              status: BrandingLogoStatus.UPLOADED,
            },
          ],
        },
      };

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      await expect(
        brandingService.initLogoUpload(userId, "foo.jpeg")
      ).rejects.toThrow(new UserError("You can't have more than 3 logos"));

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);
    });

    it("Updates db and returns URL details to upload the logo to", async () => {
      const primaryKey = "PRIMARY-KEY";
      const anotherValidKey = "ANOTHER-VALID-KEY";
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: primaryKey,
          entries: [
            {
              fileKey: primaryKey,
              status: BrandingLogoStatus.UPLOADED,
            },
            {
              fileKey: anotherValidKey,
              status: BrandingLogoStatus.UPLOADED,
            },
          ],
        },
      };
      const fileName = "foo.jpeg";
      const s3ResMock = "https://dont.care";
      const updateResMock = { dont: "care" };

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const createSignedUploadUrlMock = jest
        .spyOn(brandingService, "createSignedUploadUrl")
        .mockResolvedValueOnce(s3ResMock);
      const updateMock = jest
        .spyOn(brandingService.model, "update")
        .mockResolvedValueOnce(updateResMock);

      const createDestinationFileKeySpy = jest.spyOn(
        brandingService,
        "createDestinationFileKey"
      );

      const res = await brandingService.initLogoUpload(userId, fileName);
      expect(res).toMatchObject({ url: s3ResMock });

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);

      expect(createSignedUploadUrlMock.mock.calls.length).toBe(1);
      expect(createSignedUploadUrlMock.mock.calls[0]).toMatchObject([
        fileName,
        ConfigProvider.BRANDING_BUCKET,
        brandingService.validExtensions,
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          outFileKey: createDestinationFileKeySpy.mock.results[0].value,
        },
        "putObject",
      ]);

      expect(updateMock.mock.calls.length).toBe(1);
      expect(updateMock.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {
            logos: {
              entries: [
                {
                  fileKey: primaryKey,
                  status: BrandingLogoStatus.UPLOADED,
                },
                {
                  fileKey: anotherValidKey,
                  status: BrandingLogoStatus.UPLOADED,
                },
                {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  fileKey: createDestinationFileKeySpy.mock.results[0].value,
                  status: BrandingLogoStatus.INITIALIZED,
                },
              ],
              primaryEntry: primaryKey,
            },
          },
        },
      ]);

      expect(
        /* eslint-disable-next-line
        @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-call
      */
        createDestinationFileKeySpy.mock.results[0].value.slice(0, 9)
      ).toBe(`${id}/`);
      expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        createDestinationFileKeySpy.mock.results[0].value.length
      ).toBe(35);
    });

    it("If the logo to be uploaded will be the only logo, sets it as primary", async () => {
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          entries: [],
        },
      };
      const fileName = "foo.jpeg";
      const s3ResMock = "https://dont.care";
      const updateResMock = { dont: "care" };

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const createSignedUploadUrlMock = jest
        .spyOn(brandingService, "createSignedUploadUrl")
        .mockResolvedValueOnce(s3ResMock);
      const updateMock = jest
        .spyOn(brandingService.model, "update")
        .mockResolvedValueOnce(updateResMock);

      const createDestinationFileKeySpy = jest.spyOn(
        brandingService,
        "createDestinationFileKey"
      );

      const res = await brandingService.initLogoUpload(userId, fileName);
      expect(res).toMatchObject({ url: s3ResMock });

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);

      expect(createSignedUploadUrlMock.mock.calls.length).toBe(1);
      expect(createSignedUploadUrlMock.mock.calls[0]).toMatchObject([
        fileName,
        ConfigProvider.BRANDING_BUCKET,
        brandingService.validExtensions,
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          outFileKey: createDestinationFileKeySpy.mock.results[0].value,
        },
        "putObject",
      ]);

      expect(updateMock.mock.calls.length).toBe(1);
      expect(updateMock.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {
            logos: {
              entries: [
                {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  fileKey: createDestinationFileKeySpy.mock.results[0].value,
                  status: BrandingLogoStatus.INITIALIZED,
                },
              ],
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              primaryEntry: createDestinationFileKeySpy.mock.results[0].value,
            },
          },
        },
      ]);

      expect(
        /* eslint-disable-next-line
        @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-call
      */
        createDestinationFileKeySpy.mock.results[0].value.slice(0, 9)
      ).toBe(`${id}/`);
      expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        createDestinationFileKeySpy.mock.results[0].value.length
      ).toBe(35);
    });
  });

  describe("Logo deletion", () => {
    it("Rejects request if the fileKey is invalid", async () => {
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDoc);

      await expect(
        brandingService.delLogo(userId, "SOME-VALUE")
      ).rejects.toThrow(new UserError("Invalid fileKey"));

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);
    });

    it("Updates db and deletes file from s3", async () => {
      const primaryKey = "PRIMARY-KEY";
      const fileKeyToDelete = "ANOTHER-VALID-KEY";
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: primaryKey,
          entries: [
            {
              fileKey: primaryKey,
              status: BrandingLogoStatus.UPLOADED,
            },
            {
              fileKey: fileKeyToDelete,
              status: BrandingLogoStatus.UPLOADED,
            },
          ],
        },
      };
      const updateResMock = { dont: "care" };

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const s3DeleteMock = jest
        .spyOn(brandingService, "deleteObject")
        .mockImplementationOnce(async () => Promise.resolve());
      const updateMock = jest
        .spyOn(brandingService.model, "update")
        .mockResolvedValue(updateResMock);

      await brandingService.delLogo(userId, fileKeyToDelete);

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);

      expect(s3DeleteMock.mock.calls.length).toBe(1);
      expect(s3DeleteMock.mock.calls[0]).toMatchObject([
        ConfigProvider.BRANDING_BUCKET,
        fileKeyToDelete,
      ]);

      expect(updateMock.mock.calls.length).toBe(1);
      expect(updateMock.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {
            logos: {
              primaryEntry: primaryKey,
              entries: [
                {
                  fileKey: primaryKey,
                  status: BrandingLogoStatus.UPLOADED,
                },
              ],
            },
          },
        },
      ]);
    });

    it("Resets the primary logo if the existing one is deleted", async () => {
      const fileKeyToDelete = "PRIMARY-KEY";
      const anotherKey = "ANOTHER-VALID-KEY";
      const brandingDocWithLogos: BrandingDocument = {
        ...brandingDoc,
        logos: {
          primaryEntry: fileKeyToDelete,
          entries: [
            {
              fileKey: fileKeyToDelete,
              status: BrandingLogoStatus.UPLOADED,
            },
            {
              fileKey: anotherKey,
              status: BrandingLogoStatus.UPLOADED,
            },
          ],
        },
      };
      const updateResMock = { dont: "care" };

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const s3DeleteMock = jest
        .spyOn(brandingService, "deleteObject")
        .mockImplementationOnce(async () => Promise.resolve());
      const updateMock = jest
        .spyOn(brandingService.model, "update")
        .mockResolvedValue(updateResMock);

      await brandingService.delLogo(userId, fileKeyToDelete);

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);

      expect(s3DeleteMock.mock.calls.length).toBe(1);
      expect(s3DeleteMock.mock.calls[0]).toMatchObject([
        ConfigProvider.BRANDING_BUCKET,
        fileKeyToDelete,
      ]);

      expect(updateMock.mock.calls.length).toBe(1);
      expect(updateMock.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {
            logos: {
              primaryEntry: anotherKey,
              entries: [
                {
                  fileKey: anotherKey,
                  status: BrandingLogoStatus.UPLOADED,
                },
              ],
            },
          },
        },
      ]);
    });
  });
});
