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

export enum UserUpdatePaths {
  stripeCustomerId = "/stripeCustomerId",
  favouriteRecipes = "/favouriteRecipes",
}

const userDynamooseSchema = new DynamooseSchema({
  id: {
    type: String,
    hashKey: true,
  },
  stripeCustomerId: {
    type: String,
  },
  referralId: {
    type: String,
    index: {
      name: "referralId-index",
      global: true,
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
        },
      },
    ],
  },
  createdAt: Number,
  updatedAt: Number,
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
