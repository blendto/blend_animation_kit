import { HeroImageFileKeys } from "server/base/models/heroImage";
import DynamoDB from "server/external/dynamodb";

export class BlendService {
  dataStore: DynamoDB;

  constructor(dataStore?: DynamoDB) {
    this.dataStore = dataStore ?? DynamoDB._();
  }

  async getBlendIdsForBatch(batchId: string): Promise<string[]> {
    const data = await this.dataStore.queryItems({
      TableName: process.env.BLEND_DYNAMODB_TABLE,
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
      UpdateExpression:
        "SET updatedAt = :updatedAt, heroImages = :heroImages",
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":heroImages": heroImageFileKeys,
      },
      Key: { id: blendId },
      TableName: process.env.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async getBlendIdsForUser(uid: string): Promise<string[]> {
    const data = await this.dataStore.queryItems({
      TableName: process.env.BLEND_DYNAMODB_TABLE,
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
}
