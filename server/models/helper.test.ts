import {
  BrandingStatus,
  BrandingModel,
  BrandingDocument,
} from "server/models/branding";
import ModelHelper from "server/models/helper";

describe("ModelHelper", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generateId", () => {
    it("Generates a random string of a specific size", () => {
      const id = ModelHelper.generateId(10);
      expect(typeof id).toBe("string");
      expect(id.length).toBe(10);
    });
  });

  describe("createWithId", () => {
    const id = "wNALVbEj";
    const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
    const logos = {
      entries: [],
    };
    const updatedAt = "2022-03-08T12:33:41.362Z";
    const status = BrandingStatus.CREATED;

    it("Creates a document with the passed attributes added with a random id", async () => {
      const generateIdSpy = jest
        .spyOn(ModelHelper, "generateId")
        .mockReturnValueOnce(id);
      const createSpy = jest
        .spyOn(BrandingModel, "create")
        .mockImplementationOnce(
          async (params): Promise<BrandingDocument> =>
            Promise.resolve({ ...params, logos, updatedAt, status })
        );

      const res = await ModelHelper.createWithId(BrandingModel, { userId });
      expect(res).toMatchObject({ id, userId, logos, updatedAt, status });

      expect(generateIdSpy.mock.calls.length).toBe(1);
      expect(generateIdSpy.mock.calls[0]).toMatchObject([]);

      expect(createSpy.mock.calls.length).toBe(1);
      expect(createSpy.mock.calls[0]).toMatchObject([{ id, userId }]);
    });

    it("Retries with a new random id if a generated id is found to be existent", async () => {
      const anotherId = "qjApfyW9";
      const generateIdSpy = jest
        .spyOn(ModelHelper, "generateId")
        .mockReturnValueOnce(id)
        .mockReturnValueOnce(anotherId);
      const createSpy = jest
        .spyOn(BrandingModel, "create")
        .mockRejectedValueOnce({ code: "ConditionalCheckFailedException" })
        .mockImplementationOnce(
          async (params): Promise<BrandingDocument> =>
            Promise.resolve({ ...params, logos, updatedAt, status })
        );

      const res = await ModelHelper.createWithId(BrandingModel, { userId });
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
});
