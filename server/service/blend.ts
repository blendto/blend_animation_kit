import DynamoDB from "../external/dynamodb";

export class BlendService {
  dataStore: DynamoDB;

  constructor(dataStore?: DynamoDB) {
    this.dataStore = dataStore ?? DynamoDB._();
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
