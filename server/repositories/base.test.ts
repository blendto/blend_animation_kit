import { DynamooseRepo } from "./base";
import {
  BrandingEntity,
  brandingRepo,
  BrandingStatus,
  BrandingUpdateOperations,
  BrandingUpdatePaths,
} from "./branding";

describe("Repo", () => {
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
        .mockRejectedValueOnce({
          code: "ConditionalCheckFailedException",
        } as never)
        .mockImplementationOnce(async (params) =>
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
    it("transforms update body from JSONPatch to dynamoose specific patch", async () => {
      const id = "wNALVbEj";
      const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
      const updatedAt = 1646906641;
      const status = BrandingStatus.CREATED;
      const modelUpdateSpy = jest
        .spyOn(brandingRepo.model, "update")
        .mockResolvedValueOnce({
          id,
          userId,
          logos: {
            entries: [],
          },
          updatedAt,
          status,
        } as never);

      const whatsappNo = "+91 999 888 7776";
      await brandingRepo.update({ id }, [
        {
          op: BrandingUpdateOperations.remove,
          path: BrandingUpdatePaths.email,
        },
        {
          op: BrandingUpdateOperations.add,
          path: BrandingUpdatePaths.whatsappNo,
          value: whatsappNo,
        },
      ]);

      expect(modelUpdateSpy.mock.calls.length).toBe(1);
      expect(modelUpdateSpy.mock.calls[0]).toMatchObject([
        { id },
        {
          $SET: {
            [BrandingUpdatePaths.whatsappNo]: whatsappNo,
          },
          $REMOVE: [BrandingUpdatePaths.email],
        },
      ]);
    });
  });
});
