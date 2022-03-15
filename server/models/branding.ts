import ConfigProvider from "server/base/ConfigProvider";
import {
  Document,
  Schema,
  model,
  Model,
} from "server/models/object-data-mapper";

export const MAX_LOGOS = 3;

export enum BrandingLogoStatus {
  INITIALIZED = "INITIALIZED",
  UPLOADED = "UPLOADED",
}

export enum BrandingStatus {
  CREATED = "CREATED",
}

export class BrandingDocument extends Document {
  id: string;
  userId: string;
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

const brandingSchema = new Schema(
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

export const BrandingModel: Model<BrandingDocument> = model<BrandingDocument>(
  ConfigProvider.BRANDING_DYNAMODB_TABLE,
  brandingSchema,
  {
    create: false,
  }
);
