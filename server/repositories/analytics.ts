import {
  DynamooseEntity,
  dynamooseModel,
  DynamooseModel,
  DynamooseRepo,
  DynamooseSchema,
  Repo,
} from "server/repositories/base";
import ConfigProvider from "server/base/ConfigProvider";
import { Analytics } from "server/base/models/analytics";

const analyticsDynamooseSchema = new DynamooseSchema({
  id: { type: String, hashKey: true },
  dataType: String,
  source: String,
  createdBy: String,
  createdAt: Number,
  createdOn: String,
  metadata: { type: Object },
});

interface AnalyticsDynamooseEntity extends DynamooseEntity, Analytics {}

export class AnalyticsDynamooseRepo
  extends DynamooseRepo<Analytics, AnalyticsDynamooseEntity>
  implements Repo<Analytics>
{
  model: DynamooseModel<AnalyticsDynamooseEntity> = dynamooseModel(
    ConfigProvider.ANALYTICS_DYNAMODB_TABLE,
    analyticsDynamooseSchema,
    {
      create: false,
    }
  );
}
