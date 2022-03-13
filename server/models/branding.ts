import { Document, Schema, model } from "server/models/object-data-mapper";
import ConfigProvider from "server/base/ConfigProvider";

export enum brandingLogoStatus {
  INITIALIZED = "INITIALIZED",
  UPLOADED = "UPLOADED",
}

export enum brandingStatus {
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
    entries: { fileKey: string; status: brandingLogoStatus }[];
  };
  updatedAt?: number;
  status?: brandingStatus;
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
          schema: {
            fileKey: String,
            status: {
              type: String,
              enum: Object.values(brandingLogoStatus),
            },
          },
        },
      },
      default: { entries: [] },
    },
    status: {
      type: String,
      enum: Object.values(brandingStatus),
      default: brandingStatus.CREATED,
    },
  },
  {
    timestamps: {
      createdAt: null,
      updatedAt: "updatedAt",
    },
  }
);

export const BrandingModel = model<BrandingDocument>(
  ConfigProvider.BRANDING_DYNAMODB_TABLE,
  brandingSchema,
  {
    create: false,
  }
);
