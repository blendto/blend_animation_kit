import {
  DynamooseEntity,
  dynamooseModel,
  DynamooseModel,
  DynamooseRepo,
  DynamooseSchema,
  Repo,
} from "server/repositories/base";
import ConfigProvider from "server/base/ConfigProvider";
import { User } from "server/base/models/user";
import { RecipeSource } from "server/base/models/recipeList";

export enum UserUpdatePaths {
  stripeCustomerId = "/stripeCustomerId",
  favouriteRecipes = "/favouriteRecipes",
  appleOfflineToken = "/appleOfflineToken",
  name = "/name",
}

const userDynamooseSchema = new DynamooseSchema({
  id: {
    type: String,
    hashKey: true,
  },
  stripeCustomerId: {
    type: String,
  },
  appleOfflineToken: {
    type: String,
  },
  referralId: {
    type: String,
    index: {
      name: "referralId-index",
      type: "global",
    },
  },
  referralLink: String,
  name: String,
  email: String,
  phone: String,
  socialHandles: {
    type: Object,
    schema: {
      instagram: String,
    },
  },
  locale: String,
  countryCode: String,
  profilePicture: String,
  activitySummary: {
    type: Object,
    schema: {
      posts: Number,
      shoutoutsReceived: Number,
    },
  },
  favouriteRecipes: {
    type: Array,
    schema: [
      {
        type: Object,
        schema: {
          recipeId: { type: String, required: true },
          recipeVariant: { type: String, required: true },
          source: {
            type: String,
            enum: Object.values(RecipeSource),
          },
        },
      },
    ],
  },
  createdAt: Number,
  updatedAt: Number,
  canAccessInternalTools: Boolean,
});

interface UserDynamooseEntity extends DynamooseEntity, User {}

export class UserDynamooseRepo
  extends DynamooseRepo<User, UserDynamooseEntity>
  implements Repo<User>
{
  model: DynamooseModel<UserDynamooseEntity> = dynamooseModel(
    ConfigProvider.USER_DYNAMODB_TABLE,
    userDynamooseSchema,
    {
      create: false,
      waitForActive: false,
    }
  );
}
