import "reflect-metadata";
import { nanoid } from "nanoid";
import { DateTime } from "luxon";

import { IService } from "./index";
import { HeroImageFileKeys } from "server/base/models/heroImage";
import DynamoDB from "server/external/dynamodb";
import { Blend, BlendStatus, BlendVersion } from "server/base/models/blend";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";

// Resolution to use when output object is not populated
// When aspect ratio used to be fixed, these were the constant ones.
const FALLBACK_OUTPUT_RESOLUTION = { width: 720, height: 1280 };
const FALLBACK_OUTPUT_THUMBNAIL_RESOLUTION = { width: 628, height: 1200 };

@injectable()
export class BlendService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  async getBlendIdsForBatch(batchId: string): Promise<string[]> {
    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      KeyConditionExpression: "#batchId = :batchId",
      IndexName: "batchId-blendId-index",
      ExpressionAttributeNames: {
        "#batchId": "batchId",
      },
      ExpressionAttributeValues: {
        ":batchId": batchId,
      },
      ProjectionExpression: "id",
      ScanIndexForward: false,
    });
    return data.Items.map((entry) => entry.id as string);
  }

  async addHeroKeysToBlend(
    blendId: string,
    heroImageFileKeys: HeroImageFileKeys
  ) {
    await this.dataStore.updateItem({
      UpdateExpression: "SET updatedAt = :updatedAt, heroImages = :heroImages",
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":heroImages": heroImageFileKeys,
      },
      Key: { id: blendId },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async getBlendIdsForUser(uid: string): Promise<string[]> {
    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "createdBy-updatedAt-idx",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
      },
      ProjectionExpression: "id",
      ScanIndexForward: true,
    });
    return data.Items.map((entry) => entry.id as string);
  }

  async getBlend(
    id: string,
    version: BlendVersion = BlendVersion.current
  ): Promise<Blend> {
    let blend = await this.dataStore.getItem({
      TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
      Key: {
        id,
        version: version,
      },
    });

    if (!blend) {
      // TODO: Remove this post migration. This is a HACK to fix consistency issues.
      blend = await this.dataStore.getItem({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        Key: {
          id,
        },
      });
    }

    if (!blend) {
      return null;
    }

    return this.backfillBlendOutput(<Blend>blend);
  }

  async initBlend(
    uid: string,
    options?: { batchId: string; heroFileName: string }
  ): Promise<Blend> {
    let blendRequestId: string;
    do {
      blendRequestId = nanoid(8);
      const item = await this.dataStore.getItem({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        Key: {
          id: blendRequestId,
        },
      });
      if (!item) {
        break;
      }
    } while (true);

    let fileKey = null;
    if (options?.heroFileName) {
      fileKey = `${blendRequestId}/${options.heroFileName}`;
    }

    return await this.addBlendToDB(blendRequestId, uid, {
      batchId: options?.batchId,
      heroImages: {
        original: fileKey,
      },
    });
  }

  async addBlendToDB(
    id: string,
    userId?: string,
    options?: { batchId: string; heroImages: HeroImageFileKeys }
  ): Promise<Blend> {
    const currentTime = Date.now();
    const currentDate = DateTime.utc().toISODate();

    let blend: Blend = {
      id: id,
      version: BlendVersion.current,
      batchId: options?.batchId,
      status: BlendStatus.Initialized,
      statusUpdates: [
        {
          status: BlendStatus.Initialized,
          on: currentTime,
        },
      ],
      expireAt: DateTime.local()
        .plus({ days: 1 })
        .startOf("second")
        .toSeconds(),
      createdAt: currentTime,
      createdOn: currentDate,
      updatedAt: currentTime,
      updatedOn: currentDate,
      heroImages: options?.heroImages,
      ...(userId !== null && { createdBy: userId }),
    };

    await this.dataStore.putItem({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      Item: blend,
    });
    return blend;
  }

  backfillBlendOutput(item: Blend) {
    let { filePath, imagePath, thumbnail, output, status } = item;

    if (!output && status == "GENERATED") {
      output = {
        video: {
          path: filePath,
          resolution: FALLBACK_OUTPUT_RESOLUTION,
        },
        image: {
          path: imagePath,
          resolution: FALLBACK_OUTPUT_RESOLUTION,
        },
        thumbnail: {
          path: thumbnail,
          resolution: FALLBACK_OUTPUT_THUMBNAIL_RESOLUTION,
        },
      };
    }

    return {
      ...item,
      filePath: output?.video.path ?? null,
      imagePath: output?.image.path ?? null,
      thumbnail: output?.thumbnail.path ?? null,
      output: output ?? null,
    };
  }

  async getRecentBlends(uid: string) {
    return <Blend[]>(
      await this.dataStore.queryItems({
        TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
        KeyConditionExpression: "#createdBy = :createdBy",
        IndexName: "created-by-idx",
        ExpressionAttributeNames: {
          "#createdBy": "createdBy",
          "#status": "status",
          "#version": "version",
        },
        ExpressionAttributeValues: {
          ":createdBy": uid,
          ":generatedStatus": "GENERATED",
          ":generatedVersion": "GENERATED",
        },
        ProjectionExpression: "id, metadata",
        FilterExpression:
          "#version = :generatedVersion AND #status = :generatedStatus",
        ScanIndexForward: false,
        Limit: 20,
      })
    ).Items;
  }
}
