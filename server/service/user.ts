import "reflect-metadata";
import ConfigProvider from "server/base/ConfigProvider";
import DynamoDB from "server/external/dynamodb";
import BlendService from "server/service/blend";
import { IService } from "server/service";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { inject, injectable } from "inversify";
import IpApi from "server/external/ipapi";
import { UserAgentDetails } from "server/base/models/userAgentDetails";

@injectable()
export default class UserService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  ipApi = new IpApi();

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
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async migrateUserBlends(
    sourceUid: string,
    targetUid: string
  ): Promise<string[]> {
    const blendService = diContainer.get<BlendService>(TYPES.BlendService);
    const blendIds = await blendService.getBlendIdsForUser(sourceUid);
    const updates = blendIds.map(async (blendId) => {
      await this.updateBlendOwner(blendId, targetUid);
      return blendId;
    });
    return Promise.all(updates);
  }

  async getUserAgent(ip: string): Promise<UserAgentDetails | null> {
    if (!ip) {
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const ipDetails = await this.ipApi.getIpInfo(ip);
      /*
        eslint-disable-next-line
        @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-argument
      */
      return new UserAgentDetails(ipDetails.country_code);
    } catch (err) {
      console.error(err);
      return null;
    }
  }
}
