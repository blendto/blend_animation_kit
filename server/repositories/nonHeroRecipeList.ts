import {
  DynamooseEntity,
  dynamooseModel,
  DynamooseModel,
  DynamooseRepo,
  DynamooseSchema,
  Entity,
  Repo,
} from "./base";
import ConfigProvider from "../base/ConfigProvider";
import { NonHeroRecipeList } from "../base/models/nonHeroRecipeList";

export interface NonHeroRecipeListEntity extends NonHeroRecipeList, Entity {}

interface NonHeroRecipeListDynamooseEntity
  extends DynamooseEntity,
    NonHeroRecipeListEntity {}

const nonHeroRecipeListDynamooseSchema = new DynamooseSchema({
  id: {
    type: String,
    hashKey: true,
  },
  isEnabled: {
    type: Number,
    index: {
      name: "isEnabled-index",
      type: "global",
    },
  },
  title: String,
  sortOrder: Number,
  recipes: {
    type: Array,
    schema: [
      {
        type: Object,
        schema: {
          id: String,
          variant: String,
          extra: {
            type: Object,
            schema: {
              title: String,
              thumbnail: String,
              isPremium: Boolean,
            },
          },
        },
      },
    ],
  },
  filters: {
    type: Object,
    schema: {
      countryCodes: {
        type: Array,
        schema: [
          {
            type: String,
          },
        ],
      },
    },
  },
  translation: {
    type: Array,
    schema: [
      {
        type: Object,
        schema: {
          language: String,
          title: String,
          searchTerms: {
            type: Array,
            schema: [{ type: String }],
          },
        },
      },
    ],
  },
});

export class NonHeroRecipeListDynamooseRepo
  extends DynamooseRepo<
    NonHeroRecipeListEntity,
    NonHeroRecipeListDynamooseEntity
  >
  implements Repo<NonHeroRecipeListEntity>
{
  model: DynamooseModel<NonHeroRecipeListDynamooseEntity> = dynamooseModel(
    ConfigProvider.NON_HERO_RECIPE_LIST_DYNAMODB_TABLE,
    nonHeroRecipeListDynamooseSchema,
    {
      create: false,
      waitForActive: false,
    }
  );
}
