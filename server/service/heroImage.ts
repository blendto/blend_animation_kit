import "reflect-metadata";
import { nanoid } from "nanoid";

import AWS from "server/external/aws";
import DynamoDB from "server/external/dynamodb";
import {
  copyObject,
  deleteMultipleObjects,
  deleteObject,
  getObject,
  listObjectsInFolder,
  uploadObject,
} from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import {
  generateHeroBucketFileKeys,
  HeroImage,
  ImageFileKeys,
  HeroImageStatus,
  HeroImageStatusUpdate,
} from "server/base/models/heroImage";
import { rescaleImage } from "server/helpers/imageUtils";
import { bufferToStream } from "server/helpers/bufferUtils";
import { ObjectNotFoundError } from "server/base/errors";
import { IService } from "server/service";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import logger from "server/base/Logger";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { HeroImageIdBased } from "server/service/fileKeysProcessingStrategy";
import { BlendFromHeroImage } from "server/base/models/batch";

@injectable()
export default class HeroImageService implements IService {
  // This is required to be able to mock these functions in tests
  nanoid = nanoid;
  copyObject = copyObject;
  getObject = getObject;
  uploadObject = uploadObject;
  deleteObject = deleteObject;
  rescaleImage = rescaleImage;
  bufferToStream = bufferToStream;
  // //

  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  public static createBatchBlends(
    heroImageIds: string[],
    uid: string,
    batchId: string
  ): Promise<BlendFromHeroImage>[] {
    const blendService = diContainer.get<BlendService>(TYPES.BlendService);
    return heroImageIds.map(async (id) => {
      const blend = await blendService.initBlend(uid, {
        batchId,
      });
      const fileKeys = await new HeroImageIdBased(id, blend.id, uid).process();
      await blendService.addOrUpdateImageFileKeys(blend, fileKeys, {
        isHeroImage: true,
      });
      return { blendId: blend.id, heroImageId: id };
    });
  }

  async getImagesForUser(
    pageKeyObject: AWS.DynamoDB.DocumentClient.Key,
    uid: string
  ): Promise<{
    images: HeroImage[];
    pageKeyObject: AWS.DynamoDB.DocumentClient.Key | null;
  }> {
    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
      KeyConditionExpression: "#userId = :userId",
      IndexName: "userId-lastUsedAt-index",
      FilterExpression: "#status <> :status",
      ExpressionAttributeNames: {
        "#userId": "userId",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":userId": uid,
        ":status": HeroImageStatus.DELETED,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject,
      Limit: 20,
    });
    return {
      images: data.Items.map((image) => image as HeroImage),
      pageKeyObject: data.LastEvaluatedKey,
    };
  }

  async getImage(
    id: string,
    uid: string,
    returnOnlyOwn = false
  ): Promise<HeroImage | null> {
    const heroImage = (await this.dataStore.getItem({
      TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
      Key: { id },
    })) as HeroImage | null;

    const validOwners = returnOnlyOwn ? [uid] : [uid, "DEFAULT_USER"];
    if (
      heroImage === null ||
      !validOwners.includes(heroImage.userId) ||
      heroImage.status === HeroImageStatus.DELETED
    ) {
      if (heroImage && !validOwners.includes(heroImage.userId)) {
        logger.error({
          op: "UNAUTH_HERO_IMAGE_ACCESS",
          message: `Some user is trying to access another user's hero image!. User id: ${uid}. Image id: ${id}`,
        });
        // Don't differentiate response so as to avoid enumeration attacks.
      }
      throw new ObjectNotFoundError("Hero image not found");
    }
    return heroImage;
  }

  async markImageUsage(id: string): Promise<void> {
    const params = {
      UpdateExpression: "SET lastUsedAt = :lastUsedAt",
      ExpressionAttributeValues: {
        ":lastUsedAt": Date.now(),
      },
      Key: { id },
      TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    };
    await this.dataStore.updateItem(params);
  }

  async createNewImage(
    blendId: string,
    userId: string,
    blendBucketFileKeys: ImageFileKeys
  ): Promise<HeroImage> {
    const heroImageId = this.nanoid(16);
    const heroBucketFilekeys = generateHeroBucketFileKeys(
      heroImageId,
      blendBucketFileKeys
    );

    const copyOriginalFile: Promise<any> = this.copyObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      blendBucketFileKeys.original,
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroBucketFilekeys.original
    );

    const copyBgRemovedFile: Promise<any> = this.copyObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      blendBucketFileKeys.withoutBg,
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroBucketFilekeys.withoutBg
    );

    const saveThumbnail: Promise<void> = this.createAndSaveThumbnail(
      blendBucketFileKeys.withoutBg,
      heroBucketFilekeys.thumbnail
    );

    await Promise.all([copyOriginalFile, copyBgRemovedFile, saveThumbnail]);

    const now = Date.now();
    const updatedAt = now;
    const status = HeroImageStatus.CREATED;
    const heroImage = {
      id: heroImageId,
      original: heroBucketFilekeys.original,
      withoutBg: heroBucketFilekeys.withoutBg,
      thumbnail: heroBucketFilekeys.thumbnail,
      lastUsedAt: now,
      createdAt: now,
      updatedAt,
      userId,
      sourceBlendId: blendId,
      status,
      statusHistory: [{ status, updatedAt } as HeroImageStatusUpdate],
    } as HeroImage;
    await this.dataStore.putItem({
      TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
      Item: heroImage,
    });

    return heroImage;
  }

  async updateBgRemoved(
    heroImageId: string,
    blendId: string,
    userId: string,
    blendBucketFileKeys: ImageFileKeys
  ): Promise<HeroImage> {
    const oldHero = await this.getImage(heroImageId, userId);
    const fileKeysToDelete = [oldHero.withoutBg, oldHero.thumbnail];
    const heroBucketFilekeys = generateHeroBucketFileKeys(
      heroImageId,
      blendBucketFileKeys
    );

    const copyBgRemovedFile: Promise<any> = this.copyObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      blendBucketFileKeys.withoutBg,
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroBucketFilekeys.withoutBg
    );

    const saveThumbnail: Promise<void> = this.createAndSaveThumbnail(
      blendBucketFileKeys.withoutBg,
      heroBucketFilekeys.thumbnail
    );

    await Promise.all([copyBgRemovedFile, saveThumbnail]);

    const params = {
      UpdateExpression:
        "SET lastUsedAt = :lastUsedAt, withoutBg = :withoutBg, thumbnail = :thumbnail",
      ExpressionAttributeValues: {
        ":lastUsedAt": Date.now(),
        ":withoutBg": heroBucketFilekeys.withoutBg,
        ":thumbnail": heroBucketFilekeys.thumbnail,
      },
      Key: { id: heroImageId },
      TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
      ReturnValues: "ALL_NEW",
    };
    const heroImage = (await this.dataStore.updateItem(params))
      .Attributes as HeroImage;

    await Promise.all(
      fileKeysToDelete.map((fileKey) =>
        this.deleteObject(ConfigProvider.HERO_IMAGES_BUCKET, fileKey)
      )
    );

    return heroImage;
  }

  async deleteImage(id: string, uid: string): Promise<void> {
    const heroImage = await this.getImage(id, uid, true);
    await this.deleteObject(
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroImage.original
    );
    const updatedAt = Date.now();
    const status = HeroImageStatus.DELETED;
    const updateExpressions = [
      "updatedAt = :updatedAt",
      "#status = :status",
      "#statusHistory = list_append(if_not_exists(#statusHistory, :empty_list), :statusUpdate)",
    ];
    await this.dataStore.updateItem({
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: {
        "#status": "status",
        "#statusHistory": "statusHistory",
      },
      ExpressionAttributeValues: {
        ":updatedAt": updatedAt,
        ":status": status,
        ":empty_list": [],
        ":statusUpdate": [{ status, updatedAt } as HeroImageStatusUpdate],
      },
      Key: { id },
      TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  private async createAndSaveThumbnail(
    inputFileKey: string,
    thumbnailFileKey: string
  ) {
    const bgRemoved: Buffer = await this.getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      inputFileKey
    );
    const thumbnail = await this.rescaleImage(bgRemoved, { width: 240 });
    await this.uploadObject(
      ConfigProvider.HERO_IMAGES_BUCKET,
      thumbnailFileKey,
      this.bufferToStream(thumbnail)
    );
  }

  async getAllUserImages(uid: string): Promise<Partial<HeroImage>[]> {
    let images: Partial<HeroImage>[] = [];
    let pageKeyObject: Record<string, unknown>;
    do {
      // eslint-disable-next-line no-await-in-loop
      const data = await this.dataStore.queryItems({
        TableName: ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
        KeyConditionExpression: "#userId = :userId",
        IndexName: "userId-lastUsedAt-index",
        ExpressionAttributeNames: {
          "#userId": "userId",
        },
        ExpressionAttributeValues: {
          ":userId": uid,
        },
        ProjectionExpression: "id",
        ExclusiveStartKey: pageKeyObject,
      });
      images = images.concat(data.Items);
      pageKeyObject = data.LastEvaluatedKey;
    } while (pageKeyObject);

    return images;
  }

  async cleanupUserImages(uid: string): Promise<void> {
    const images = await this.getAllUserImages(uid);
    const deleteS3ObjectsPromises: Promise<void>[] = images.map(
      (i) =>
        new Promise((resolve, reject) => {
          listObjectsInFolder(ConfigProvider.HERO_IMAGES_BUCKET, i.id)
            .then((heroObjects) => {
              if (heroObjects.length) {
                return deleteMultipleObjects(
                  ConfigProvider.HERO_IMAGES_BUCKET,
                  heroObjects.map((o) => o.Key)
                );
              }
            })
            .then(() => resolve())
            .catch((err) => reject(err));
        })
    );
    await Promise.all(deleteS3ObjectsPromises);
    await this.dataStore.batchDeleteItems(
      ConfigProvider.HERO_IMAGES_DYNAMODB_TABLE,
      images
    );
  }
}
