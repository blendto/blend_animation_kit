import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UserError } from "server/base/errors";

import { DynamooseRepo } from "./base";
import { UpdateOperations } from ".";
import {
  BrandingDynamooseRepo,
  BrandingEntity,
  BrandingInfoType,
  BrandingLogoStatus,
  BrandingStatus,
  BrandingUpdatePaths,
} from "./branding";

describe("Repo", () => {
  const brandingRepo = new BrandingDynamooseRepo();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generateId", () => {
    it("Generates a random string of a specific size", () => {
      const id = DynamooseRepo.generateId(10);
      expect(typeof id).toBe("string");
      expect(id.length).toBe(10);
    });
  });

  describe("create", () => {
    const id = "wNALVbEj";
    const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
    const logos = {
      entries: [],
    };
    const updatedAt = "2022-03-08T12:33:41.362Z";
    const status = BrandingStatus.CREATED;

    it("Creates a document with the passed attributes added with a random id", async () => {
      const generateIdSpy = jest
        .spyOn(DynamooseRepo, "generateId")
        .mockReturnValueOnce(id);
      const createSpy = jest
        .spyOn(brandingRepo.model, "create")
        .mockImplementationOnce(async (params) =>
          Promise.resolve({
            ...params,
            logos,
            updatedAt,
            status,
          })
        );

      const res = await brandingRepo.create({ userId });
      expect(res).toMatchObject({ id, userId, logos, updatedAt, status });

      expect(generateIdSpy.mock.calls.length).toBe(1);
      expect(generateIdSpy.mock.calls[0]).toMatchObject([]);

      expect(createSpy.mock.calls.length).toBe(1);
      expect(createSpy.mock.calls[0]).toMatchObject([{ id, userId }]);
    });

    it("Retries with a new random id if a generated id is found to be existent", async () => {
      const anotherId = "qjApfyW9";
      const generateIdSpy = jest
        .spyOn(DynamooseRepo, "generateId")
        .mockReturnValueOnce(id)
        .mockReturnValueOnce(anotherId);
      const createSpy = jest
        .spyOn(brandingRepo.model, "create")
        .mockImplementationOnce((params) =>
          // eslint-disable-next-line prefer-promise-reject-errors
          Promise.reject(
            new ConditionalCheckFailedException({
              $metadata: {},
              message: "",
            })
          )
        )
        .mockImplementationOnce((params) =>
          Promise.resolve({
            ...params,
            logos,
            updatedAt,
            status,
          })
        );

      const res = await brandingRepo.create({ userId });
      expect(res).toMatchObject({
        id: anotherId,
        userId,
        logos,
        updatedAt,
        status,
      });

      expect(generateIdSpy.mock.calls.length).toBe(2);
      expect(generateIdSpy.mock.calls[0]).toMatchObject([]);
      expect(generateIdSpy.mock.calls[1]).toMatchObject([]);

      expect(createSpy.mock.calls.length).toBe(2);
      expect(createSpy.mock.calls[0]).toMatchObject([{ id, userId }]);
      expect(createSpy.mock.calls[1]).toMatchObject([
        { id: anotherId, userId },
      ]);
    });
  });

  describe("update", () => {
    const whatsappNo = "+91 999 888 7776";

    it("Transforms update body from JSONPatch to dynamoose specific patch", async () => {
      const id = "wNALVbEj";
      const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
      const updatedAt = 1646906641;
      const status = BrandingStatus.CREATED;
      const primaryLogoFileKey = "FILE-KEY-1";
      const otherLogoFileKey = "FILE-KEY-2";
      const branding: BrandingEntity = {
        id,
        userId,
        logos: {
          entries: [
            {
              fileKey: primaryLogoFileKey,
              status: BrandingLogoStatus.UPLOADED,
              size: { width: 128, height: 128 },
              removeBg: true,
            },
            {
              fileKey: otherLogoFileKey,
              status: BrandingLogoStatus.UPLOADED,
              size: { width: 128, height: 128 },
              removeBg: true,
            },
          ],
          primaryEntry: primaryLogoFileKey,
        },
        info: [],
        updatedAt,
        status,
      };
      const modelGetSyp = jest
        .spyOn(brandingRepo, "get")
        .mockResolvedValueOnce(branding);
      const modelUpdateSpy = jest
        .spyOn(brandingRepo.model, "update")
        .mockImplementation((keyObject, updateSet) =>
          Promise.resolve(branding)
        );

      await brandingRepo.update({ id }, [
        {
          op: UpdateOperations.replace,
          path: BrandingUpdatePaths.info,
          value: [
            {
              type: BrandingInfoType.WhatsappNo,
              value: whatsappNo,
              link: `https://wa.me/${whatsappNo}`,
            },
          ],
        },
        {
          op: UpdateOperations.replace,
          path: BrandingUpdatePaths.primaryLogo,
          value: otherLogoFileKey,
        },
      ]);

      expect(modelGetSyp.mock.calls.length).toBe(1);
      expect(modelGetSyp.mock.calls[0]).toMatchObject([{ id }]);
      expect(modelUpdateSpy.mock.calls.length).toBe(1);
      expect(modelUpdateSpy.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {
            info: [
              {
                type: BrandingInfoType.WhatsappNo,
                value: whatsappNo,
                link: `https://wa.me/${whatsappNo}`,
              },
            ],
            logos: {
              entries: [
                {
                  fileKey: primaryLogoFileKey,
                  status: "UPLOADED",
                },
                {
                  fileKey: otherLogoFileKey,
                  status: "UPLOADED",
                },
              ],
              primaryEntry: otherLogoFileKey,
            },
          },
        },
      ]);
    });

    it("Doesn't fetch current data if there are no nested updates", async () => {
      const id = "wNALVbEj";
      const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
      const updatedAt = 1646906641;
      const status = BrandingStatus.CREATED;
      const branding: BrandingEntity = {
        id,
        userId,
        logos: {
          entries: [],
        },
        info: [],
        updatedAt,
        status,
      };
      const modelGetSyp = jest.spyOn(brandingRepo, "get");
      const modelUpdateSpy = jest
        .spyOn(brandingRepo.model, "update")
        .mockImplementation((keyObject, updateSet) =>
          Promise.resolve(branding)
        );

      await brandingRepo.update({ id }, [
        {
          op: UpdateOperations.replace,
          path: BrandingUpdatePaths.info,
          value: [{ type: BrandingInfoType.WhatsappNo, value: whatsappNo }],
        },
      ]);

      expect(modelGetSyp.mock.calls.length).toBe(0);
      expect(modelUpdateSpy.mock.calls.length).toBe(1);
      expect(modelUpdateSpy.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {
            info: [
              {
                type: BrandingInfoType.WhatsappNo,
                value: whatsappNo,
              },
            ],
          },
        },
      ]);
    });

    it("Rejects request if the keyObject is invalid", async () => {
      const id = "wNALVbEj";
      const modelGetSyp = jest
        .spyOn(brandingRepo, "get")
        .mockImplementation(({ id }) => Promise.resolve());

      await expect(
        brandingRepo.update({ id }, [
          {
            op: UpdateOperations.replace,
            path: BrandingUpdatePaths.primaryLogo,
            value: "FILE-KEY-2",
          },
        ])
      ).rejects.toThrow(new UserError("Invalid keyObject"));
      expect(modelGetSyp.mock.calls.length).toBe(1);
      expect(modelGetSyp.mock.calls[0]).toMatchObject([{ id }]);
    });
  });
});
