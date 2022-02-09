import DynamoDB from "../external/dynamodb";
import { BlendService } from "./blend";

export class UserService {
  dataStore: DynamoDB;
  blendService: BlendService;

  constructor(blendService: BlendService, dataStore?: DynamoDB) {
    this.blendService = blendService;
    this.dataStore = dataStore ?? DynamoDB._();
  }

  private async updateBlendOwner(blendId: string, newUid: string) {
    await this.dataStore.updateItem({
      UpdateExpression: "SET #updatedAt = :updatedAt, #createdBy = :createdBy",
      ExpressionAttributeNames: {
        "#updatedAt": "updatedAt",
        "#createdBy": "createdBy",
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":createdBy": newUid,
      },
      Key: { id: blendId },
      TableName: process.env.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async migrateUserBlends(
    sourceUid: string,
    targetUid: string
  ): Promise<string[]> {
    const blendIds = await this.blendService.getBlendIdsForUser(sourceUid);
    const updates = blendIds.map(async (blendId) => {
      await this.updateBlendOwner(blendId, targetUid);
      return blendId;
    });
    return await Promise.all(updates);
  }
}
