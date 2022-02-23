import { Stream } from "node:stream";
import { randomBytes } from "crypto";

import ConfigProvider from "server/base/ConfigProvider";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import HeroImageService from "server/service/heroImage";
import DynamoDB from "server/external/dynamodb";
import {
  HeroImage,
  HeroImageStatus,
  HeroImageStatusUpdate,
} from "server/base/models/heroImage";
import { ObjectNotFoundError } from "server/base/errors";

describe("HeroImageService", () => {
  const heroImageService = diContainer.get<HeroImageService>(
      TYPES.HeroImageService
    ),
    imageId = "b-_-sDqEW7LK150e",
    userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2",
    anotherUserId = "L8aASeH26gRzSvr6K9Yb3InuKb02",
    now = 1645009809102,
    image = {
      id: imageId,
      original: "b-_-sDqEW7LK150e.jpg",
      withoutBg: "b-_-sDqEW7LK150e-bg-removed.png",
      thumbnail: "b-_-sDqEW7LK150e-thumbnail.png",
      lastUsedAt: now,
      createdAt: now,
      userId,
      sourceBlendId: "NxY2SIx2",
    },
    defaultUserimage = {
      ...image,
      userId: "DEFAULT_USER",
    };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Particular image retreival", () => {
    it("Raises NotFound error if there's no image matching the id", async () => {
      const getItemSpy = jest
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "getItem")
        .mockResolvedValueOnce(null);
      await expect(heroImageService.getImage(imageId, userId)).rejects.toThrow(
        ObjectNotFoundError
      );
      expect(getItemSpy.mock.calls.length).toBe(1);
      expect(getItemSpy.mock.calls[0]).toMatchObject([
        {
          TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
          Key: { id: imageId },
        },
      ]);
    });

    it("Raises NotFound error if the image doesn't belong to the user", async () => {
      const consoleErrorMock = jest.spyOn(console, "error");
      jest
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "getItem")
        .mockResolvedValueOnce({
          ...image,
          userId: anotherUserId,
        });
      await expect(heroImageService.getImage(imageId, userId)).rejects.toThrow(
        ObjectNotFoundError
      );
      expect(consoleErrorMock.mock.calls.length).toBe(1);
      expect(consoleErrorMock.mock.calls[0]).toMatchObject([
        {
          op: "UNAUTH_HERO_IMAGE_ACCESS",
          message:
            "Some user is trying to access another user's hero image!. User id: uxFJ2pRfNeMtfOO1dH5UhHKQbah2. Image id: b-_-sDqEW7LK150e",
        },
      ]);
    });

    it("Raises NotFound error if the image was deleted", async () => {
      jest
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "getItem")
        .mockResolvedValueOnce({
          ...image,
          status: HeroImageStatus.DELETED,
        });
      await expect(heroImageService.getImage(imageId, userId)).rejects.toThrow(
        ObjectNotFoundError
      );
    });

    it('Returns the image if it belongs to "DEFAULT_USER"', async () => {
      jest
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "getItem")
        .mockResolvedValueOnce(defaultUserimage);
      const res = await heroImageService.getImage(imageId, userId);
      expect(res).toMatchObject(defaultUserimage);
    });

    it('Raises NotFound error if the image belongs to "DEFAULT_USER" but "returnOnlyOwn" flag is true', async () => {
      const consoleErrorMock = jest.spyOn(console, "error");
      jest
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "getItem")
        .mockResolvedValueOnce(defaultUserimage);
      await expect(
        heroImageService.getImage(imageId, userId, true)
      ).rejects.toThrow(ObjectNotFoundError);
      expect(consoleErrorMock.mock.calls.length).toBe(1);
      expect(consoleErrorMock.mock.calls[0]).toMatchObject([
        {
          op: "UNAUTH_HERO_IMAGE_ACCESS",
          message:
            "Some user is trying to access another user's hero image!. User id: uxFJ2pRfNeMtfOO1dH5UhHKQbah2. Image id: b-_-sDqEW7LK150e",
        },
      ]);
    });

    it("Returns the image if it belongs to the user", async () => {
      jest
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "getItem")
        .mockResolvedValueOnce(image);
      const res = await heroImageService.getImage(imageId, userId);
      expect(res).toMatchObject(image);
    });
  });

  describe("User images retreival", () => {
    it("Returns all images belonging to the user", async () => {
      const queryItemsSpy = jest
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "queryItems")
        .mockResolvedValueOnce({
          Items: [image],
          LastEvaluatedKey: null,
        });
      const res = await heroImageService.getImagesForUser(null, userId);
      expect(queryItemsSpy.mock.calls.length).toBe(1);
      expect(queryItemsSpy.mock.calls[0]).toMatchObject([
        {
          TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
          KeyConditionExpression: "#userId = :userId",
          IndexName: "userId-lastUsedAt-index",
          FilterExpression: "#status <> :status",
          ExpressionAttributeNames: {
            "#userId": "userId",
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":userId": userId,
            ":status": HeroImageStatus.DELETED,
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
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "updateItem")
        .mockResolvedValueOnce({});
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
          TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
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
      const updatedAt = now;
      const status = HeroImageStatus.CREATED;
      const image = {
        id: newImageId,
        original: heroImageFileKey,
        withoutBg: heroImageFileKeyWithoutBg,
        thumbnail: heroImageFileKeyThumbnail,
        lastUsedAt: now,
        createdAt: now,
        userId: userId,
        sourceBlendId: blendId,
        updatedAt,
        status,
        statusHistory: [{ status, updatedAt } as HeroImageStatusUpdate],
      } as HeroImage;

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
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "putItem")
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
          TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
          Item: image,
        },
      ]);
      expect(res).toMatchObject(image);
    });
  });

  describe("Image deletion", () => {
    it("Deletes the actual image but retains the metadata if image belongs to the user", async () => {
      const getImageSpy = jest
        .spyOn(heroImageService, "getImage")
        .mockResolvedValueOnce(image as unknown as HeroImage);
      const deleteObjectSpy = jest
        .spyOn(heroImageService, "deleteObject")
        .mockResolvedValueOnce();
      const updateItemSpy = jest
        .spyOn(diContainer.get<DynamoDB>(TYPES.DynamoDB), "updateItem")
        .mockResolvedValueOnce({});
      jest.spyOn(Date, "now").mockReturnValueOnce(now);

      await expect(
        heroImageService.deleteImage(imageId, userId)
      ).resolves.not.toThrow();
      expect(getImageSpy.mock.calls.length).toBe(1);
      expect(getImageSpy.mock.calls[0]).toMatchObject([imageId, userId, true]);
      expect(deleteObjectSpy.mock.calls.length).toBe(1);
      expect(deleteObjectSpy.mock.calls[0]).toMatchObject([
        ConfigProvider.HERO_IMAGES_BUCKET,
        image.original,
      ]);
      expect(updateItemSpy.mock.calls.length).toBe(1);
      const status = HeroImageStatus.DELETED;
      expect(updateItemSpy.mock.calls[0]).toMatchObject([
        {
          UpdateExpression:
            "SET updatedAt = :updatedAt, #status = :status, #statusHistory = list_append(if_not_exists(#statusHistory, :empty_list), :statusUpdate)",
          ExpressionAttributeNames: {
            "#status": "status",
            "#statusHistory": "statusHistory",
          },
          ExpressionAttributeValues: {
            ":updatedAt": now,
            ":status": status,
            ":empty_list": [],
            ":statusUpdate": [
              {
                status,
                updatedAt: now,
              } as HeroImageStatusUpdate,
            ],
          },
          Key: { id: imageId },
          TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
          ReturnValues: "NONE",
        },
      ]);
    });
  });
});
