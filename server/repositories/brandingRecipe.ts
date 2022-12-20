import ConfigProvider from "server/base/ConfigProvider";
import { BrandingRecipe } from "server/base/models/brandingRecipe";
import {
  DynamooseEntity,
  dynamooseModel,
  DynamooseModel,
  DynamooseRepo,
  DynamooseSchema,
  Repo,
} from "./base";

const brandingRecipeDynamooseSchema = new DynamooseSchema(
  {
    id: {
      type: String,
      hashKey: true,
    },
    variant: {
      type: String,
      rangeKey: true,
    },
    userId: {
      type: String,
      index: {
        name: "userId-lastUsedAt-index",
        type: "global",
        rangeKey: "lastUsedAt",
      },
    },
  },
  {
    saveUnknown: true,
    timestamps: {
      createdAt: "createdAt",
      updatedAt: ["updatedAt", "lastUsedAt"],
    },
  }
);

interface BrandingRecipeDynamooseEntity
  extends DynamooseEntity,
    BrandingRecipe {}

export class BrandingRecipeDynamooseRepo
  extends DynamooseRepo<BrandingRecipe, BrandingRecipeDynamooseEntity>
  implements Repo<BrandingRecipe>
{
  model: DynamooseModel<BrandingRecipeDynamooseEntity> = dynamooseModel(
    ConfigProvider.BRANDING_RECIPE_DYNAMODB_TABLE,
    brandingRecipeDynamooseSchema,
    {
      create: false,
      waitForActive: false,
    }
  );
}
