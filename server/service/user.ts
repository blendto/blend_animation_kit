import DynamoDB from "../external/dynamodb";
import { BlendService } from "./blend";
import { DynamoBasedServiceLocator, IService } from "./index";

export class UserService implements IService {
  dataStore: DynamoDB;
  serviceLocator: DynamoBasedServiceLocator;

  constructor(dataStore: DynamoDB, serviceLocator: DynamoBasedServiceLocator) {
    this.dataStore = dataStore;
    this.serviceLocator = serviceLocator;
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
    const blendService = this.serviceLocator.find(BlendService);
    const blendIds = await blendService.getBlendIdsForUser(sourceUid);
    const updates = blendIds.map(async (blendId) => {
      await this.updateBlendOwner(blendId, targetUid);
      return blendId;
    });
    return await Promise.all(updates);
  }
}
