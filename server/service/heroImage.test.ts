import { Stream } from "node:stream";
import { randomBytes } from "crypto";

import ConfigProvider from "server/base/ConfigProvider";
import HeroImageService from "server/service/heroImage";
import DynamoDB from "server/external/dynamodb";

describe("HeroImageService", () => {
  const heroImageService = new HeroImageService(),
    imageId = "b-_-sDqEW7LK150e",
    userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2",
    image = {
      id: imageId,
      original: "b-_-sDqEW7LK150e.jpg",
      withoutBg: "b-_-sDqEW7LK150e-bg-removed.png",
      thumbnail: "b-_-sDqEW7LK150e-thumbnail.png",
      lastUsedAt: "1645001845761",
      createdAt: "1645001845761",
      userId,
      sourceBlendId: "NxY2SIx2",
    };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Particular image retreival", () => {
    it("Returns null if there's no image matching the id", async () => {
      const getItemSpy = jest
        .spyOn(DynamoDB._(), "getItem")
        .mockResolvedValueOnce(null);
      const res = await heroImageService.getImage(imageId, userId);
      expect(getItemSpy.mock.calls.length).toBe(1);
      expect(getItemSpy.mock.calls[0]).toMatchObject([
        {
          TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
          Key: { id: imageId },
        },
      ]);
      expect(res).toBe(null);
    });

    it("Returns null if the image doesn't belong to the user", async () => {
      const getItemSpy = jest
        .spyOn(DynamoDB._(), "getItem")
        .mockResolvedValueOnce({
          ...image,
          userId: "K9zASeH56gRzZvr6K9Yb2InuUb02",
        });
      const res = await heroImageService.getImage(imageId, userId);
      expect(res).toBe(null);
    });

    it('Returns the image if it belongs to "DEFAULT_USER"', async () => {
      const defaultUserimage = {
        ...image,
        userId: "DEFAULT_USER",
      };
      const getItemSpy = jest
        .spyOn(DynamoDB._(), "getItem")
        .mockResolvedValueOnce(defaultUserimage);
      const res = await heroImageService.getImage(imageId, userId);
      expect(res).toMatchObject(defaultUserimage);
    });

    it("Returns the image if it belongs to the user", async () => {
      const getItemSpy = jest
        .spyOn(DynamoDB._(), "getItem")
        .mockResolvedValueOnce(image);
      const res = await heroImageService.getImage(imageId, userId);
      expect(res).toMatchObject(image);
    });
  });

  describe("User images retreival", () => {
    it("Returns all images belonging to the user", async () => {
      const queryItemsSpy = jest
        .spyOn(DynamoDB._(), "queryItems")
        .mockResolvedValueOnce({
          Items: [image],
          LastEvaluatedKey: null,
        });
      const res = await heroImageService.getImagesForUser(null, userId);
      expect(queryItemsSpy.mock.calls.length).toBe(1);
      expect(queryItemsSpy.mock.calls[0]).toMatchObject([
        {
          TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
          KeyConditionExpression: "#userId = :userId",
          IndexName: "userId-lastUsedAt-index",
          ExpressionAttributeNames: {
            "#userId": "userId",
          },
          ExpressionAttributeValues: {
            ":userId": userId,
          },
          ScanIndexForward: false,
          ExclusiveStartKey: null,
          Limit: 20,
        },
      ]);
      expect(res).toMatchObject({
        images: [image],
        pageKeyObject: null,
      });
    });
  });

  describe("Image usage update", () => {
    it("Updates the last used timestamp of an image", async () => {
      const updateItemSpy = jest
        .spyOn(DynamoDB._(), "updateItem")
        .mockResolvedValueOnce({});
      const now = 1645009809102;
      jest.spyOn(Date, "now").mockReturnValueOnce(now);
      const res = await heroImageService.markImageUsage(imageId);
      expect(updateItemSpy.mock.calls.length).toBe(1);
      expect(updateItemSpy.mock.calls[0]).toMatchObject([
        {
          UpdateExpression: "SET lastUsedAt = :lastUsedAt",
          ExpressionAttributeValues: {
            ":lastUsedAt": now,
          },
          Key: { id: imageId },
          TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
          ReturnValues: "NONE",
        },
      ]);
    });
  });

  describe("Image creation", () => {
    it("Copies blend original, copies blend without background, saves thumbnail and saves data to db", async () => {
      const blendId = "NxY2SIx2";
      const newImageId = "sywFj0-DLsN5-9uV_gSMo";
      const heroImageFileKey = `${newImageId}.jpg`;
      const heroImageFileKeyWithoutBg = `${newImageId}-bg-removed.png`;
      const heroImageFileKeyThumbnail = `${newImageId}-thumbnail.png`;
      const fileKey = "NxY2SIx2/Ofvyno391qDDBDLk7JqPA.jpg";
      const fileKeyWithoutBg = "NxY2SIx2/Ofvyno391qDDBDLk7JqPA-bg-removed.png";
      const now = 1645009809102;
      const image = {
        id: newImageId,
        original: heroImageFileKey,
        withoutBg: heroImageFileKeyWithoutBg,
        thumbnail: heroImageFileKeyThumbnail,
        lastUsedAt: now,
        createdAt: now,
        userId: userId,
        sourceBlendId: blendId,
      };
      process.env.BLEND_INGREDIENTS_BUCKET = "whatever";
      process.env.HERO_IMAGES_BUCKET = "whatever";

      heroImageService.nanoid = jest.fn(() => newImageId);
      const copyObjectMock = (heroImageService.copyObject = jest.fn(
        async (
          sourceBucket: string,
          sourceKey: string,
          destBucket: string,
          destKey: string
        ) => Promise.resolve({})
      ));
      const getObjectMockRes = randomBytes(64);
      const getObjectMock = (heroImageService.getObject = jest.fn(
        async (bucketName: string, fileKey: string): Promise<Buffer> =>
          getObjectMockRes
      ));
      const rescaleImageMockRes = randomBytes(32);
      const rescaleImageMock = (heroImageService.rescaleImage = jest.fn(
        async (
          image: Buffer,
          width: number,
          height?: number
        ): Promise<Buffer> => rescaleImageMockRes
      ));
      const bufferToStreamMockRes =
        heroImageService.bufferToStream(rescaleImageMockRes);
      const bufferToStreamMock = (heroImageService.bufferToStream = jest.fn(
        (binary: Buffer) => bufferToStreamMockRes
      ));
      const uploadObjectMock = (heroImageService.uploadObject = jest.fn(
        async (bucketName: string, fileKey: string, stream: Stream) =>
          Promise.resolve()
      ));
      jest.spyOn(Date, "now").mockReturnValueOnce(now);
      const putItemSpy = jest
        .spyOn(DynamoDB._(), "putItem")
        .mockResolvedValueOnce({});

      const res = await heroImageService.createNewImage(blendId, userId, {
        original: fileKey,
        withoutBg: fileKeyWithoutBg,
      });
      expect(copyObjectMock.mock.calls.length).toBe(2);
      expect(copyObjectMock.mock.calls[0]).toMatchObject([
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        fileKey,
        ConfigProvider.HERO_IMAGES_BUCKET,
        heroImageFileKey,
      ]);
      expect(copyObjectMock.mock.calls[1]).toMatchObject([
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        fileKeyWithoutBg,
        ConfigProvider.HERO_IMAGES_BUCKET,
        heroImageFileKeyWithoutBg,
      ]);
      expect(getObjectMock.mock.calls.length).toBe(1);
      expect(getObjectMock.mock.calls[0]).toMatchObject([
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        fileKeyWithoutBg,
      ]);
      expect(rescaleImageMock.mock.calls.length).toBe(1);
      expect(rescaleImageMock.mock.calls[0]).toMatchObject([
        getObjectMockRes,
        240,
      ]);
      expect(bufferToStreamMock.mock.calls.length).toBe(1);
      expect(bufferToStreamMock.mock.calls[0]).toMatchObject([
        rescaleImageMockRes,
      ]);
      expect(uploadObjectMock.mock.calls.length).toBe(1);
      expect(uploadObjectMock.mock.calls[0]).toMatchObject([
        ConfigProvider.HERO_IMAGES_BUCKET,
        heroImageFileKeyThumbnail,
        bufferToStreamMockRes,
      ]);
      expect(putItemSpy.mock.calls.length).toBe(1);
      expect(putItemSpy.mock.calls[0]).toMatchObject([
        {
          TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
          Item: image,
        },
      ]);
      expect(res).toMatchObject(image);
    });
  });
});
