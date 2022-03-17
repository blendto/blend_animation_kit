import ConfigProvider from "server/base/ConfigProvider";
import {
  DynamooseModel,
  DynamooseSchema,
  dynamooseModel,
  JSONPatch,
  DynamooseEntity,
  DynamooseRepo,
  Entity,
  Model,
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
  email = "email",
  contactNo = "contactNo",
  whatsappNo = "whatsappNo",
  instaHandle = "instaHandle",
  website = "website",
  address = "address",
  primaryLogo = "logos.primaryEntry",
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

abstract class BrandingRepo<
  BrandingEntity extends Entity,
  BrandingModel extends Model
> extends Repo<BrandingEntity, BrandingModel> {
  model: BrandingModel;

  abstract updateWithFormatted(
    currentData: BrandingEntity,
    jsonPatch: JSONPatch
  ): Promise<BrandingEntity>;
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

class BrandingModel extends Model {}

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

class BrandingDynamooseRepo
  extends DynamooseRepo<BrandingEntity, BrandingDynamooseEntity>
  implements BrandingRepo<BrandingEntity, BrandingModel>
{
  model: DynamooseModel<BrandingDynamooseEntity> = dynamooseModel(
    ConfigProvider.BRANDING_DYNAMODB_TABLE,
    brandingDynamooseSchema,
    {
      create: false,
    }
  );

  async updateWithFormatted(
    currentData: BrandingEntity,
    jsonPatch: JSONPatch
  ): Promise<BrandingEntity> {
    // dynamoose doesn't allow nested update on maps. Pass the whole logos object.
    // See https://github.com/dynamoose/dynamoose/issues/665
    jsonPatch.forEach((change) => {
      if (change.path === "logos.primaryEntry") {
        // eslint-disable-next-line no-param-reassign
        change.path = "logos";
        // eslint-disable-next-line no-param-reassign
        change.value = {
          ...currentData.logos,
          primaryEntry: change.value,
        };
      }
    });
    return await this.update({ id: currentData.id }, jsonPatch);
  }
}

export const brandingRepo: BrandingRepo<BrandingEntity, BrandingModel> =
  new BrandingDynamooseRepo();
