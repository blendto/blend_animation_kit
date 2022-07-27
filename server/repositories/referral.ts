import ConfigProvider from "server/base/ConfigProvider";
import {
  DynamooseEntity,
  dynamooseModel,
  DynamooseModel,
  DynamooseRepo,
  DynamooseSchema,
  Entity,
  Repo,
} from "./base";

export enum REWARD_TYPE {
  CREDITS = "CREDITS",
}

export enum REWARD_STATUS {
  INITIATED = "INITIATED",
  REWARDED = "REWARDED",
}

type REWARD = {
  type: REWARD_TYPE;
  quantity: number;
  status: REWARD_STATUS;
};

export interface ReferralEntity extends Entity {
  refereeUserId: string;
  referrerUserId: string;
  createdAt: number;
  updatedAt: number;
  reward: {
    referee: REWARD;
    referrer: REWARD;
  };
}

const rewardDynamooseSchema = new DynamooseSchema({
  type: {
    type: String,
    enum: Object.values(REWARD_TYPE),
  },
  quantity: Number,
  status: { type: String, enum: Object.values(REWARD_STATUS) },
});

const referralDynamooseSchema = new DynamooseSchema(
  {
    refereeUserId: {
      type: String,
      hashKey: true,
    },
    referrerUserId: String,
    reward: {
      type: Object,
      schema: {
        referee: { type: Object, schema: rewardDynamooseSchema },
        referrer: { type: Object, schema: rewardDynamooseSchema },
      },
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }
);

interface ReferralDynamooseEntity extends DynamooseEntity, ReferralEntity {}

export class ReferralDynamooseRepo
  extends DynamooseRepo<ReferralEntity, ReferralDynamooseEntity>
  implements Repo<ReferralEntity>
{
  model: DynamooseModel<ReferralDynamooseEntity> = dynamooseModel(
    ConfigProvider.REFERRAL_DYNAMODB_TABLE,
    referralDynamooseSchema,
    {
      create: false,
    }
  );
}
