import { nanoid } from "nanoid";

import AWS from "server/external/aws";
import DynamoDB from "server/external/dynamodb";
import { copyObject, getObject, uploadObject } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import {
  createHeroBucketFileKeys,
  HeroImage,
  HeroImageFileKeys,
} from "server/base/models/heroImage";
import { rescaleImage } from "server/helpers/imageUtils";
import { bufferToStream } from "server/helpers/bufferUtils";

export default class HeroImageService {
  dataStore: DynamoDB;

  // This is required to be able to mock these functions in tests
  nanoid = nanoid;
  copyObject = copyObject;
  getObject = getObject;
  uploadObject = uploadObject;
  rescaleImage = rescaleImage;
  bufferToStream = bufferToStream;
  // //

  constructor(dataStore?: DynamoDB) {
    this.dataStore = dataStore ?? DynamoDB._();
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
      ExpressionAttributeNames: {
        "#userId": "userId",
      },
      ExpressionAttributeValues: {
        ":userId": uid,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject,
      Limit: 20,
    });
    return {
      images: data.Items.map((entry) => entry as HeroImage),
      pageKeyObject: data.LastEvaluatedKey,
    };
  }

  async getImage(id: string, uid: string): Promise<HeroImage | null> {
    const heroImage = (await this.dataStore.getItem({
      TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
      Key: { id },
    })) as HeroImage | null;

    if (
      heroImage == null ||
      ![uid, "DEFAULT_USER"].includes(heroImage.userId)
    ) {
      return null;
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

    const heroImage = {
      id: heroImageId,
      original: heroBucketFilekeys.original,
      withoutBg: heroBucketFilekeys.withoutBg,
      thumbnail: heroBucketFilekeys.thumbnail,
      lastUsedAt: now,
      createdAt: now,
      userId: userId,
      sourceBlendId: blendId,
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
}
