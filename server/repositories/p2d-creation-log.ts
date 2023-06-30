import DynamoDB from "server/external/dynamodb";
import { inject, injectable } from "inversify";
import ConfigProvider from "server/base/ConfigProvider";
import { P2DCreationLogItem } from "server/base/models/p2d";
import { TYPES } from "server/types";
import { DateTime } from "luxon";

@injectable()
export class P2DCreationLogRepository {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  async log(item: Partial<P2DCreationLogItem>) {
    const currentTime = DateTime.utc();
    await this.dataStore.putItem({
      TableName: ConfigProvider.P2D_CREATION_LOG_TABLE,
      Item: {
        createdOn: currentTime.toISODate(),
        createdAt: currentTime.toMillis(),
        ...item,
      },
    });
  }
}
