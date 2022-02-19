import { nanoid } from "nanoid";

import AWS from "server/external/aws";
import DynamoDB from "server/external/dynamodb";
import {
  copyObject,
  getObject,
  uploadObject,
  deleteObject,
} from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import {
  createHeroBucketFileKeys,
  HeroImage,
  HeroImageStatus,
  HeroImageStatusUpdate,
  HeroImageFileKeys,
} from "server/base/models/heroImage";
import { rescaleImage } from "server/helpers/imageUtils";
import { bufferToStream } from "server/helpers/bufferUtils";
import { ObjectNotFoundError } from "server/base/errors";
import { IService, DynamoBasedServiceLocator } from "server/service";

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

  dataStore: DynamoDB;
  serviceLocator: DynamoBasedServiceLocator;

  constructor(dataStore: DynamoDB, serviceLocator: DynamoBasedServiceLocator) {
    this.dataStore = dataStore;
    this.serviceLocator = serviceLocator;
  }

  async getImagesForUser(
    pageKeyObject: AWS.DynamoDB.DocumentClient.Key,
    uid: string
  ): Promise<{
    images: HeroImage[];
    pageKeyObject: AWS.DynamoDB.DocumentClient.Key | null;
  }> {
    const data = await this.dataStore.queryItems({
      TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
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
    returnOnlyOwn: boolean = false
  ): Promise<HeroImage | null> {
    const heroImage = (await this.dataStore.getItem({
      TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
      Key: { id },
    })) as HeroImage | null;

    const validOwners = returnOnlyOwn ? [uid] : [uid, "DEFAULT_USER"];
    if (
      heroImage === null ||
      !validOwners.includes(heroImage.userId) ||
      heroImage.status === HeroImageStatus.DELETED
    ) {
      if (heroImage && !validOwners.includes(heroImage.userId)) {
        console.error({
          op: "UNAUTH_HERO_IMAGE_ACCESS",
          message: `Some user is trying to access another user's hero image!. User id: ${uid}. Image id: ${id}`,
        });
        // Don't differentiate response so as to avoid enumeration attacks.
      }
      throw new ObjectNotFoundError("Hero image not found");
    }
    return heroImage;
  }

  async markImageUsage(id: String): Promise<void> {
    const params = {
      UpdateExpression: "SET lastUsedAt = :lastUsedAt",
      ExpressionAttributeValues: {
        ":lastUsedAt": Date.now(),
      },
      Key: { id: id },
      TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    };
    await this.dataStore.updateItem(params);
  }

  async createNewImage(
    blendId: String,
    userId: String,
    blendBucketFileKeys: HeroImageFileKeys
  ): Promise<HeroImage> {
    const heroImageId = this.nanoid(16);
    const heroBucketFilekeys = createHeroBucketFileKeys(
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
      userId: userId,
      sourceBlendId: blendId,
      status,
      statusHistory: [{ status, updatedAt } as HeroImageStatusUpdate],
    } as HeroImage;

    await DynamoDB._().putItem({
      TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
      Item: heroImage,
    });

    return heroImage;
  }

  private async createAndSaveThumbnail(
    inputFileKey: string,
    thumbnailFileKey: string
  ) {
    const bgRemoved: Buffer = await this.getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      inputFileKey
    );
    const thumbnail = await this.rescaleImage(bgRemoved, 240);
    await this.uploadObject(
      ConfigProvider.HERO_IMAGES_BUCKET,
      thumbnailFileKey,
      this.bufferToStream(thumbnail)
    );
  }

  async deleteImage(id: string, uid: string): Promise<void> {
    const heroImage = (await this.getImage(id, uid, true)) as HeroImage | null;
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
      Key: { id: id },
      TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
    return;
  }
}
