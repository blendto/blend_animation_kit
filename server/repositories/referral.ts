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

export enum RewardType {
  CREDITS = "CREDITS",
}

export enum RewardStatus {
  INITIATED = "INITIATED",
  REWARDED = "REWARDED",
}

type REWARD = {
  type: RewardType;
  quantity: number;
  status: RewardStatus;
};

export interface ReferralEntity extends Entity {
  refereeUserId: string;
  referrerUserId: string;
  createdAt: number;
  updatedAt: number;
  deviceId: string;
  reward: {
    referee: REWARD;
    referrer: REWARD;
  };
}

const rewardDynamooseSchema = new DynamooseSchema({
  type: {
    type: String,
    enum: Object.values(RewardType),
  },
  quantity: Number,
  status: { type: String, enum: Object.values(RewardStatus) },
});

const referralDynamooseSchema = new DynamooseSchema(
  {
    refereeUserId: {
      type: String,
      hashKey: true,
    },
    referrerUserId: {
      type: String,
      index: {
        name: "referrerUserId-refereeUserId-index",
        global: true,
        rangeKey: "refereeUserId",
      },
    },
    deviceId: {
      type: String,
      index: {
        name: "deviceId-index",
        global: true,
      },
    },
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
      waitForActive: false,
    }
  );
}
