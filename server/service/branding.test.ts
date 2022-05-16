import { readFileSync } from "fs";
import { diContainer } from "inversify.config";

import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import {
  BrandingLogoStatus,
  BrandingStatus,
  BrandingUpdateOperations,
  BrandingUpdatePaths,
  BrandingEntity,
} from "server/repositories/branding";
import BrandingService from "server/service/branding";
import { TYPES } from "server/types";

describe("BrandingService", () => {
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const id = "wNALVbEj";
  const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
  const updatedAt = 1646906641;
  const status = BrandingStatus.CREATED;
  const brandingDoc = {
    id,
    userId,
    logos: {
      entries: [],
    },
    updatedAt,
    status,
  } as BrandingEntity;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Get or create", () => {
    it("Creates branding profile for the user if non-existent", async () => {
      const querySpy = jest
        .spyOn(brandingService.repo, "query")
        .mockResolvedValue([]);
      const createSpy = jest
        .spyOn(brandingService.repo, "create")
        .mockResolvedValueOnce(brandingDoc);

      const res = await brandingService.getOrCreate(userId);
      expect(res).toMatchObject(brandingDoc);

      expect(querySpy.mock.calls.length).toBe(1);
      expect(querySpy.mock.calls[0]).toMatchObject([{ userId }]);

      expect(createSpy.mock.calls.length).toBe(1);
      expect(createSpy.mock.calls[0]).toMatchObject([{ userId }]);
    });

    it("Retrieves the branding profile for the user if existent", async () => {
      const querySpy = jest
        .spyOn(brandingService.repo, "query")
        .mockResolvedValueOnce([brandingDoc]);
      const createSpy = jest.spyOn(brandingService.repo, "create");

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
            op: BrandingUpdateOperations.add,
            path: BrandingUpdatePaths.primaryLogo,
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
      const brandingDocWithLogos = {
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
      } as BrandingEntity;
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);

      await expect(
        brandingService.update(userId, [
          {
            op: BrandingUpdateOperations.add,
            path: BrandingUpdatePaths.primaryLogo,
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
      const brandingDocWithLogos = {
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
      } as BrandingEntity;
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);

      await expect(
        brandingService.update(userId, [
          {
            op: BrandingUpdateOperations.add,
            path: BrandingUpdatePaths.primaryLogo,
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
      const brandingDocWithLogos = {
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
      } as BrandingEntity;
      const updatedBrandingDoc = {
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
      } as BrandingEntity;
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const modelUpdateMock = jest
        .spyOn(brandingService.repo, "update")
        .mockResolvedValueOnce(updatedBrandingDoc);

      const jsonPatch = [
        {
          op: BrandingUpdateOperations.add,
          path: BrandingUpdatePaths.primaryLogo,
          value: anotherValidKey,
        },
      ];
      const res = await brandingService.update(userId, jsonPatch);
      expect(res).toMatchObject(updatedBrandingDoc);

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);

      expect(modelUpdateMock.mock.calls.length).toBe(1);
      expect(modelUpdateMock.mock.calls[0]).toMatchObject([
        { id },
        jsonPatch,
        brandingDocWithLogos,
      ]);
    });

    it("Rejects unsetting primary logo", async () => {
      const primaryKey = "PRIMARY-FILE-KEY";
      const brandingDocWithLogos = {
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
      } as BrandingEntity;
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);

      await expect(
        brandingService.update(userId, [
          {
            op: BrandingUpdateOperations.remove,
            path: BrandingUpdatePaths.primaryLogo,
          },
        ])
      ).rejects.toThrow(new UserError("Primary logo pointer can't be unset"));

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);
    });

    it("Supports unsetting other attributes", async () => {
      const email = "engg@blend.to";
      const whatsappNo = "+91 999 999 9991@blend.to";
      const brandingDocWithOtherAttrs = {
        ...brandingDoc,
        email,
        whatsappNo,
      } as BrandingEntity;
      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithOtherAttrs);
      const modelUpdateMock = jest
        .spyOn(brandingService.repo, "update")
        .mockResolvedValueOnce(brandingDoc);

      const jsonPatch = [
        {
          op: BrandingUpdateOperations.remove,
          path: BrandingUpdatePaths.email,
        },
        {
          op: BrandingUpdateOperations.remove,
          path: BrandingUpdatePaths.whatsappNo,
        },
      ];
      const res = await brandingService.update(userId, jsonPatch);
      expect(res).toMatchObject(brandingDoc);

      expect(getOrCreateMock.mock.calls.length).toBe(1);
      expect(getOrCreateMock.mock.calls[0]).toMatchObject([userId]);

      expect(modelUpdateMock.mock.calls.length).toBe(1);
      expect(modelUpdateMock.mock.calls[0]).toMatchObject([
        { id },
        jsonPatch,
        brandingDocWithOtherAttrs,
      ]);
    });
  });

  describe("Logo initiation", () => {
    it("Rejects request if the profile already already has 3 logos", async () => {
      const primaryKey = "PRIMARY-KEY";
      const brandingDocWithLogos = {
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
      } as BrandingEntity;

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
      const brandingDocWithLogos = {
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
      } as BrandingEntity;
      const fileName = "foo.jpeg";
      const s3ResMock = "https://dont.care";
      const updateResMock = {
        ...brandingDocWithLogos,
        logos: {
          ...brandingDocWithLogos.logos,
          entries: [
            ...brandingDocWithLogos.logos.entries,
            {
              fileKey: "THE-NEWLY-GENERATED-KEY",
              status: BrandingLogoStatus.INITIALIZED,
            },
          ],
        },
      } as BrandingEntity;

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const createSignedUploadUrlMock = jest
        .spyOn(brandingService, "createSignedUploadUrl")
        .mockResolvedValueOnce(s3ResMock);
      const updateMock = jest
        .spyOn(brandingService.repo, "update")
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
          operation: "putObject",
        },
      ]);

      expect(updateMock.mock.calls.length).toBe(1);
      expect(updateMock.mock.calls[0]).toMatchObject([
        { id },
        [
          {
            path: "/logos",
            op: "replace",
            value: {
              ...brandingDocWithLogos.logos,
              entries: [
                ...brandingDocWithLogos.logos.entries,
                {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  fileKey: createDestinationFileKeySpy.mock.results[0].value,
                  status: BrandingLogoStatus.INITIALIZED,
                },
              ],
            },
          },
        ],
        brandingDocWithLogos,
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
      const brandingDocWithLogos = {
        ...brandingDoc,
        logos: {
          entries: [],
        },
      } as BrandingEntity;
      const fileName = "foo.jpeg";
      const s3ResMock = "https://dont.care";
      const newlyGeneratedKey = "NEWLY-GENERATED-KEY";
      const updateResMock = {
        ...brandingDoc,
        logos: {
          entries: [
            {
              fileKey: newlyGeneratedKey,
              status: BrandingLogoStatus.INITIALIZED,
            },
          ],
          primaryEntry: newlyGeneratedKey,
        },
      } as BrandingEntity;

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const createSignedUploadUrlMock = jest
        .spyOn(brandingService, "createSignedUploadUrl")
        .mockResolvedValueOnce(s3ResMock);
      const updateMock = jest
        .spyOn(brandingService.repo, "update")
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
          operation: "putObject",
        },
      ]);

      expect(updateMock.mock.calls.length).toBe(1);
      expect(updateMock.mock.calls[0]).toMatchObject([
        { id },
        [
          {
            op: "replace",
            path: "/logos",
            value: {
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
        ],
        brandingDocWithLogos,
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

  describe("Logo update as uploaded on s3 trigger", () => {
    const fileKey = `${id}/avsDCf2bQ_MVjSKaR9IvN.jpeg`;
    it("Rejects request if the file key is missing blend id", async () => {
      await expect(brandingService.completeLogoUpload("")).rejects.toThrow(
        new UserError("Invalid fileKey")
      );
    });

    it("Rejects request if the file key has invalid blend id", async () => {
      const getSpy = jest
        .spyOn(brandingService.repo, "get")
        .mockImplementation((brandingId) => Promise.resolve());
      await expect(brandingService.completeLogoUpload(fileKey)).rejects.toThrow(
        new UserError("Invalid fileKey")
      );
      expect(getSpy.mock.calls.length).toBe(1);
      expect(getSpy.mock.calls[0]).toMatchObject([{ id }]);
    });

    it("Rejects request if the corresponding blend has no such fileKey", async () => {
      const getSpy = jest
        .spyOn(brandingService.repo, "get")
        .mockResolvedValueOnce(brandingDoc);
      await expect(brandingService.completeLogoUpload(fileKey)).rejects.toThrow(
        new UserError("Invalid fileKey")
      );
      expect(getSpy.mock.calls.length).toBe(1);
      expect(getSpy.mock.calls[0]).toMatchObject([{ id }]);
    });

    it("Rejects request if the corresponding logo is seen as already uploaded", async () => {
      const getSpy = jest
        .spyOn(brandingService.repo, "get")
        .mockResolvedValueOnce({
          ...brandingDoc,
          logos: {
            primaryEntry: fileKey,
            entries: [{ fileKey, status: BrandingLogoStatus.UPLOADED }],
          },
        } as BrandingEntity);
      await expect(brandingService.completeLogoUpload(fileKey)).rejects.toThrow(
        new UserError(
          "Logo has already been marked as uploaded. Duplicate trigger?"
        )
      );
      expect(getSpy.mock.calls.length).toBe(1);
      expect(getSpy.mock.calls[0]).toMatchObject([{ id }]);
    });

    it("Successfully does the update in the absence of above problems", async () => {
      const currentData: BrandingEntity = {
        ...brandingDoc,
        logos: {
          primaryEntry: fileKey,
          entries: [{ fileKey, status: BrandingLogoStatus.INITIALIZED }],
        },
      };
      const getSpy = jest
        .spyOn(brandingService.repo, "get")
        .mockResolvedValueOnce(currentData);
      const logoImage = readFileSync("__tests__/assets/small-png.png");
      jest.spyOn(brandingService, "getObject").mockResolvedValueOnce(logoImage);
      jest
        .spyOn(brandingService, "uploadObject")
        .mockImplementationOnce(() => Promise.resolve());
      jest
        .spyOn(brandingService, "deleteObject")
        .mockImplementationOnce(() => Promise.resolve());
      const updateSpy = jest
        .spyOn(brandingService.repo, "update")
        .mockResolvedValue({
          ...brandingDoc,
          logos: {
            primaryEntry: fileKey,
            entries: [{ fileKey, status: BrandingLogoStatus.UPLOADED }],
          },
        } as BrandingEntity);

      await brandingService.completeLogoUpload(fileKey);

      expect(getSpy.mock.calls.length).toBe(1);
      expect(getSpy.mock.calls[0]).toMatchObject([{ id }]);

      const webpFileKey = `${fileKey.split(".")[0]}.webp`;
      expect(updateSpy.mock.calls.length).toBe(1);
      expect(updateSpy.mock.calls[0]).toMatchObject([
        { id },
        [
          {
            op: "replace",
            path: "/logos",
            value: {
              primaryEntry: webpFileKey,
              entries: [
                { fileKey: webpFileKey, status: BrandingLogoStatus.UPLOADED },
              ],
            },
          },
        ],
        currentData,
      ]);
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
      const brandingDocWithLogos = {
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
      } as BrandingEntity;
      const updateResMock = {
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
      } as BrandingEntity;

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const s3DeleteMock = jest
        .spyOn(brandingService, "deleteObject")
        .mockImplementationOnce(() => Promise.resolve());
      const updateMock = jest
        .spyOn(brandingService.repo, "update")
        .mockResolvedValue(updateResMock);

      const res = await brandingService.delLogo(userId, fileKeyToDelete);
      expect(res).toMatchObject(updateResMock);

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
        [
          {
            op: "replace",
            path: "/logos",
            value: {
              primaryEntry: primaryKey,
              entries: [
                {
                  fileKey: primaryKey,
                  status: BrandingLogoStatus.UPLOADED,
                },
              ],
            },
          },
        ],
        brandingDocWithLogos,
      ]);
    });

    it("Resets the primary logo if the existing one is deleted", async () => {
      const fileKeyToDelete = "PRIMARY-KEY";
      const anotherKey = "ANOTHER-VALID-KEY";
      const brandingDocWithLogos = {
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
      } as BrandingEntity;
      const updateResMock = {
        ...brandingDoc,
        logos: {
          primaryEntry: anotherKey,
          entries: [
            {
              fileKey: anotherKey,
              status: BrandingLogoStatus.UPLOADED,
            },
          ],
        },
      } as BrandingEntity;

      const getOrCreateMock = jest
        .spyOn(brandingService, "getOrCreate")
        .mockResolvedValueOnce(brandingDocWithLogos);
      const s3DeleteMock = jest
        .spyOn(brandingService, "deleteObject")
        .mockImplementationOnce(() => Promise.resolve());
      const updateMock = jest
        .spyOn(brandingService.repo, "update")
        .mockResolvedValue(updateResMock);

      const res = await brandingService.delLogo(userId, fileKeyToDelete);
      expect(res).toMatchObject(updateResMock);

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
        [
          {
            op: "replace",
            path: "/logos",
            value: {
              primaryEntry: anotherKey,
              entries: [
                {
                  fileKey: anotherKey,
                  status: BrandingLogoStatus.UPLOADED,
                },
              ],
            },
          },
        ],
        brandingDocWithLogos,
      ]);
    });
  });
});
