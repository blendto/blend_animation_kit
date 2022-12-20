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
}

export enum BrandingStatus {
  CREATED = "CREATED",
}

export enum BrandingUpdatePaths {
  brandName = "/brandName",
  upiHandle = "/upiHandle",
  email = "/email",
  contactNo = "/contactNo",
  whatsappNo = "/whatsappNo",
  instaHandle = "/instaHandle",
  website = "/website",
  address = "/address",
  shopeeHandle = "/shopeeHandle",
  youtubeHandle = "/youtubeHandle",
  tiktokHandle = "/tiktokHandle",
  pinterestHandle = "/pinterestHandle",
  depopHandle = "/depopHandle",
  poshmarkHandle = "/poshmarkHandle",
  mercadoHandle = "/mercadoHandle",
  lazadaHandle = "/lazadaHandle",
  ebayHandle = "/ebayHandle",
  amazonHandle = "/amazonHandle",
  facebookHandle = "/facebookHandle",
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
  Address = "address",
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
}

export interface BrandingEntity extends Entity {
  id: string;
  userId: string;
  [BrandingInfoType.BrandName]?: string;
  [BrandingInfoType.UpiHandle]?: string;
  [BrandingInfoType.Email]?: string;
  [BrandingInfoType.ContactNo]?: string;
  [BrandingInfoType.WhatsappNo]?: string;
  [BrandingInfoType.InstaHandle]?: string;
  [BrandingInfoType.Website]?: string;
  [BrandingInfoType.Address]?: string;
  [BrandingInfoType.ShopeeHandle]?: string;
  [BrandingInfoType.YoutubeHandle]?: string;
  [BrandingInfoType.TiktokHandle]?: string;
  [BrandingInfoType.PinterestHandle]?: string;
  [BrandingInfoType.DepopHandle]?: string;
  [BrandingInfoType.PoshmarkHandle]?: string;
  [BrandingInfoType.MercadoHandle]?: string;
  [BrandingInfoType.LazadaHandle]?: string;
  [BrandingInfoType.EbayHandle]?: string;
  [BrandingInfoType.AmazonHandle]?: string;
  [BrandingInfoType.FacebookHandle]?: string;
  logos: {
    primaryEntry?: string;
    entries: { fileKey: string; size: Size; status: BrandingLogoStatus }[];
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
    brandName: String,
    upiHandle: String,
    email: String,
    contactNo: String,
    whatsappNo: String,
    instaHandle: String,
    website: String,
    address: String,
    shopeeHandle: String,
    youtubeHandle: String,
    tiktokHandle: String,
    pinterestHandle: String,
    depopHandle: String,
    poshmarkHandle: String,
    mercadoHandle: String,
    lazadaHandle: String,
    ebayHandle: String,
    amazonHandle: String,
    facebookHandle: String,
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
