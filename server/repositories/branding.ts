import ConfigProvider from "server/base/ConfigProvider";
import { Size } from "server/base/models/recipe";

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
  PROCESSED = "PROCESSED",
}

export enum BrandingStatus {
  CREATED = "CREATED",
}

export enum BrandingUpdatePaths {
  info = "/info",
  primaryLogo = "/logos/primaryEntry",
}

export enum BrandingUpdateOperationsOnPrimaryLogo {
  add = "add",
  replace = "replace",
}

export enum BrandingInfoType {
  BrandName = "brandName",
  UpiHandle = "upiHandle",
  Email = "email",
  ContactNo = "contactNo",
  WhatsappNo = "whatsappNo",
  InstaHandle = "instaHandle",
  Website = "website",
  ShopeeHandle = "shopeeHandle",
  YoutubeHandle = "youtubeHandle",
  TiktokHandle = "tiktokHandle",
  PinterestHandle = "pinterestHandle",
  DepopHandle = "depopHandle",
  PoshmarkHandle = "poshmarkHandle",
  MercadoHandle = "mercadoHandle",
  LazadaHandle = "lazadaHandle",
  EbayHandle = "ebayHandle",
  AmazonHandle = "amazonHandle",
  FacebookHandle = "facebookHandle",
  TokopediaHandle = "tokopediaHandle",
  CarousellHandle = "carousellHandle",
}

export interface BrandingLogo {
  fileKey: string;
  size?: Size;
  removeBg: boolean;
  status: BrandingLogoStatus;
}

export enum BrandingLogoFromUploadsSource {
  HERO_IMAGE = "HERO_IMAGE",
}

export interface BrandingEntity extends Entity {
  id: string;
  userId: string;
  info: {
    type: BrandingInfoType;
    value: string;
    link?: string;
  }[];
  logos: {
    primaryEntry?: string;
    entries: BrandingLogo[];
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
        type: "global",
      },
    },
    info: {
      type: Array,
      schema: [
        {
          type: Object,
          schema: {
            type: {
              type: String,
              enum: Object.values(BrandingInfoType),
            },
            value: String,
            link: String,
          },
        },
      ],
      default: [],
    },
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
                size: {
                  type: Object,
                  schema: { width: Number, height: Number },
                },
                removeBg: Boolean,
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
      waitForActive: false,
    }
  );
}
