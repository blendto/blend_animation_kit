import "reflect-metadata";
import { inject, injectable } from "inversify";
import { IService } from "server/service/index";
import { Analytics, SaveAnalyticsRequest } from "server/base/models/analytics";
import { TYPES } from "server/types";
import { Repo } from "server/repositories/base";
import { DateTime } from "luxon";
import DynamoDB from "server/external/dynamodb";
import ConfigProvider from "server/base/ConfigProvider";
import { nanoid } from "nanoid";

@injectable()
export class NewAnalyticsService implements IService {
  @inject(TYPES.AnalyticsRepo) analyticsRepo: Repo<Analytics>;
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  async logAnalytics(
    createdBy: string,
    analyticsRequest: SaveAnalyticsRequest
  ): Promise<void> {
    const analytics = {
      id: nanoid(12),
      ...analyticsRequest,
      createdBy,
      createdAt: Date.now(),
      createdOn: DateTime.utc().toISODate(),
    } as Analytics;
    await this.dataStore.putItem({
      TableName: ConfigProvider.ANALYTICS_DYNAMODB_TABLE,
      Item: analytics,
    });
  }
}
