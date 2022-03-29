import "reflect-metadata";
import { nanoid } from "nanoid";
import { DateTime } from "luxon";

import { HeroImageFileKeys } from "server/base/models/heroImage";
import DynamoDB from "server/external/dynamodb";
import {
  BatchLevelEditStatus,
  Blend,
  BlendStatus,
  BlendVersion,
} from "server/base/models/blend";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import UserError from "server/base/errors/UserError";
import { IService } from "./index";

// Resolution to use when output object is not populated
// When aspect ratio used to be fixed, these were the constant ones.
const FALLBACK_OUTPUT_RESOLUTION = { width: 720, height: 1280 };
const FALLBACK_OUTPUT_THUMBNAIL_RESOLUTION = { width: 628, height: 1200 };
type BlendsPage = { blends: Blend[]; nextPageKey: string };
const PAGE_SIZE = 15;

@injectable()
export class BlendService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  async getBlendIdsForBatch(batchId: string): Promise<string[]> {
    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      KeyConditionExpression: "#batchId = :batchId",
      FilterExpression: "#status <> :status",
      IndexName: "batchId-blendId-index",
      ExpressionAttributeNames: {
        "#batchId": "batchId",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":batchId": batchId,
        ":status": BlendStatus.Deleted,
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
    version: BlendVersion = BlendVersion.current,
    consistentRead = false
  ): Promise<Blend> {
    let blend;

    if (!consistentRead) {
      blend = await this.dataStore.getItem({
        TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
        Key: { id, version },
      });
    }

    if (!blend) {
      // TODO: Remove this post migration. This is a HACK to fix consistency issues.
      blend = await this.dataStore.getItem({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        Key: {
          id,
        },
        ConsistentRead: consistentRead,
      });
    }

    if (!blend) {
      return null;
    }

    return this.backfillBlendOutput(<Blend>blend);
  }

  async initBlend(
    uid: string,
    options?: { batchId: string; heroFileName?: string }
  ): Promise<Blend> {
    let blendRequestId: string;
    do {
      blendRequestId = nanoid(8);
      /* eslint-disable no-await-in-loop */
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
        original: fileKey as string,
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

    const blend: Blend = {
      id,
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
    const { filePath, imagePath, thumbnail, status } = item;
    let { output } = item;

    if (!output && status === BlendStatus.Generated) {
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

  async clearExpiry(blendId: string) {
    await this.dataStore.updateItem({
      UpdateExpression: "REMOVE expireAt",
      Key: { id: blendId },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
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
          "#metadata": "metadata",
        },
        ExpressionAttributeValues: {
          ":createdBy": uid,
          ":generatedStatus": "GENERATED",
          ":generatedVersion": "GENERATED",
        },
        ProjectionExpression: "id, metadata",
        FilterExpression:
          "#version = :generatedVersion AND #status = :generatedStatus AND attribute_exists(#metadata)",
        ScanIndexForward: false,
        Limit: 20,
      })
    ).Items;
  }

  // TODO: Explore possibilities to reuse this inside submitBlend() in blend/[id].ts
  async updateBlend(blend: Blend) {
    const {
      images,
      externalImages,
      gifsOrStickers,
      texts,
      buttons,
      links,
      interactions,
      metadata,
    } = blend;

    const now = Date.now();
    const updatedOn = DateTime.utc().toISODate();
    const params = {
      UpdateExpression:
        "SET #st = :s, statusUpdates = list_append(statusUpdates, :update), title = :title," +
        "interactions = :inter, images = :images, externalImages = :externalImages, audios = :audios," +
        "slides = :slides, cameraClips = :clips, gifsOrStickers = :gifsOrStickers, texts = :texts, buttons = :buttons, links = :links," +
        "metadata = :metadata, updatedAt = :updatedAt, updatedOn = :updatedOn, #batchSt = :batchSt REMOVE expireAt",
      ExpressionAttributeNames: {
        "#st": "status",
        "#batchSt": "batchLevelEditStatus",
      },
      ExpressionAttributeValues: {
        ":s": "SUBMITTED",
        ":update": [{ status: "SUBMITTED", on: now }],
        ":title": null,
        ":inter": interactions,
        ":images": images,
        ":externalImages": externalImages,
        ":audios": null,
        ":slides": null,
        ":clips": null,
        ":gifsOrStickers": gifsOrStickers,
        ":texts": texts,
        ":buttons": buttons || [],
        ":links": links || [],
        ":metadata": metadata,
        ":updatedAt": now,
        ":updatedOn": updatedOn,
        ":batchSt": BatchLevelEditStatus.INDIVIDUALLY_EDITED,
      },
      Key: { id: blend.id },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    };

    await this.dataStore.updateItem(params);
  }

  async reInitialise(blendId: string): Promise<void> {
    const now = Date.now();
    const updatedOn = DateTime.utc().toISODate();
    await this.dataStore.updateItem({
      UpdateExpression:
        "SET #st = :s, updatedAt = :updatedAt, updatedOn = :updatedOn",
      ExpressionAttributeNames: {
        "#st": "batchLevelEditStatus",
      },
      ExpressionAttributeValues: {
        ":s": BatchLevelEditStatus.RECIPE_EDITED,
        ":updatedAt": now,
        ":updatedOn": updatedOn,
      },
      Key: { id: blendId },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  private async getBlendPage(
    uid: string,
    pageKey?: string
  ): Promise<BlendsPage> {
    const encodedPageKey = new EncodedPageKey(pageKey);
    if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
      throw new UserError("pageKey should be a string");
    }
    const pageKeyObject = encodedPageKey.decode();

    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "createdBy-updatedAt-idx",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
        "#status": "status",
        "#output": "output",
        "#version": "version",
        "#batchId": "batchId",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
        ":generated": "GENERATED",
        ":submitted": "SUBMITTED",
        ":currentVersion": "CURRENT",
      },
      ProjectionExpression:
        "id, filePath, imagePath, thumbnail, #output, createdAt, updatedAt, #status",
      FilterExpression:
        "(#version = :currentVersion) AND (#status = :generated OR #status = :submitted) AND attribute_not_exists(#batchId)",
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject as Record<string, unknown>,
      Limit: PAGE_SIZE,
    });

    const blends = data.Items.map((item) =>
      this.backfillBlendOutput(<Blend>item)
    );
    const nextPageKey = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;

    return { blends, nextPageKey };
  }

  async getAllBlendsForUser(
    uid: string,
    pageKey: string
  ): Promise<{ data: Blend[]; nextPageKey: string }> {
    const pageItems = { data: [], nextPageKey: pageKey };
    let fetched: BlendsPage;
    do {
      fetched = await this.getBlendPage(uid, pageItems.nextPageKey);
      pageItems.data.push(...fetched.blends);
      pageItems.nextPageKey = fetched.nextPageKey;
    } while (pageItems.data.length < PAGE_SIZE && fetched.nextPageKey);

    return pageItems;
  }

  async deleteBlend(blendId: string) {
    await this.dataStore.updateItem({
      UpdateExpression: `SET #status = :status, updatedAt = :updatedAt`,
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":status": BlendStatus.Deleted,
      },
      Key: { id: blendId },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }
}
