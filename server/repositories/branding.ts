import ConfigProvider from "server/base/ConfigProvider";

import {
  DynamooseModel,
  DynamooseSchema,
  dynamooseModel,
  DynamooseEntity,
  DynamooseRepo,
  Entity,
  Repo,
} from "./base";

export const MAX_LOGOS = 3;

export enum BrandingLogoStatus {
  INITIALIZED = "INITIALIZED",
  UPLOADED = "UPLOADED",
}

export enum BrandingStatus {
  CREATED = "CREATED",
}

export enum BrandingUpdatePaths {
  email = "/email",
  contactNo = "/contactNo",
  whatsappNo = "/whatsappNo",
  instaHandle = "/instaHandle",
  website = "/website",
  address = "/address",
  primaryLogo = "/logos/primaryEntry",
}

export enum BrandingUpdateOperationsOnPrimaryLogo {
  add = "add",
  replace = "replace",
}

export enum BrandingUpdateOperations {
  add = "add",
  replace = "replace",
  remove = "remove",
}

export interface BrandingEntity extends Entity {
  id: string;
  userId: string;
  brandName?: string;
  upiHandle?: string;
  email?: string;
  contactNo?: string;
  whatsappNo?: string;
  instaHandle?: string;
  website?: string;
  address?: string;
  logos: {
    primaryEntry?: string;
    entries: { fileKey: string; status: BrandingLogoStatus }[];
  };
  updatedAt?: number;
  status?: BrandingStatus;
}
interface BrandingDynamooseEntity extends DynamooseEntity, BrandingEntity {}

const brandingDynamooseSchema = new DynamooseSchema(
  {
    id: {
      type: String,
      hashKey: true,
    },
    userId: {
      type: String,
      index: {
        name: ConfigProvider.BRANDING_DYNAMODB_USER_ID_INDEX,
        global: true,
      },
    },
    brandName: String,
    upiHandle: String,
    email: String,
    contactNo: String,
    whatsappNo: String,
    instaHandle: String,
    website: String,
    address: String,
    logos: {
      type: Object,
      schema: {
        primaryEntry: String,
        entries: {
          type: Array,
          schema: [
            {
              type: Object,
              schema: {
                fileKey: String,
                status: {
                  type: String,
                  enum: Object.values(BrandingLogoStatus),
                },
              },
            },
          ],
        },
      },
      default: { entries: [] },
    },
    status: {
      type: String,
      enum: Object.values(BrandingStatus),
      default: BrandingStatus.CREATED,
    },
  },
  {
    timestamps: {
      createdAt: null,
      updatedAt: "updatedAt",
    },
  }
);

export class BrandingDynamooseRepo
  extends DynamooseRepo<BrandingEntity, BrandingDynamooseEntity>
  implements Repo<BrandingEntity>
{
  model: DynamooseModel<BrandingDynamooseEntity> = dynamooseModel(
    ConfigProvider.BRANDING_DYNAMODB_TABLE,
    brandingDynamooseSchema,
    {
      create: false,
    }
  );
}

export const brandingRepo: Repo<BrandingEntity> = new BrandingDynamooseRepo();
