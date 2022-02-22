import "reflect-metadata";
import { IService } from "./index";
import { HeroImageFileKeys } from "server/base/models/heroImage";
import DynamoDB from "server/external/dynamodb";
import { Blend } from "server/base/models/blend";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";

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

  async getBlend(blendId: string): Promise<Blend> {
    return (await DynamoDB._().getItem({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      Key: { id: blendId },
    })) as Blend | null;
  }
}
