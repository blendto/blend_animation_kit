import { nanoid } from "nanoid";
import { extractExtensionFromFileKey } from "server/helpers/fileKeyUtils";
import { ClassificationMetadata } from "server/base/models/removeBg";

export enum HeroImageStatus {
  CREATED = "CREATED",
  DELETED = "DELETED",
}

export type HeroImageStatusUpdate = {
  status: HeroImageStatus;
  updatedAt: number;
};

export interface HeroImage {
  id: string;
  original: string;
  withoutBg: string;
  thumbnail: string;
  lastUsedAt: number;
  createdAt: number;
  updatedAt: number;
  userId: string;
  sourceBlendId: string;
  status: HeroImageStatus;
  statusHistory: HeroImageStatusUpdate[];
}

export class ImageFileKeys {
  original: string;
  withoutBg?: string;
  mask?: string;
  trimLTWH?: [number, number, number, number];
}

export interface ExtendedHeroImageFileKeys extends ImageFileKeys {
  thumbnail?: string;
}

export class BlendHeroImage extends ImageFileKeys {
  heroImageId?: string;
  classificationMetadata?: ClassificationMetadata;
}

export const createBlendBucketFileKeys = (
  blendId: string,
  heroImage: HeroImage
): ImageFileKeys => {
  const randomId = nanoid(16);
  const originalFileExt = extractExtensionFromFileKey(heroImage.original);
  const bgRemovedFileExt = extractExtensionFromFileKey(heroImage.withoutBg);
  return {
    original: `${blendId}/${randomId}.${originalFileExt}`,
    withoutBg: `${blendId}/${randomId}-bg-removed.${bgRemovedFileExt}`,
  } as ImageFileKeys;
};

export const generateHeroBucketFileKeys = (
  heroImageId: string,
  blendBucketFileKeys: ImageFileKeys
): ExtendedHeroImageFileKeys => {
  const originalFileExt = extractExtensionFromFileKey(
    blendBucketFileKeys.original
  );
  const bgRemovedFileExt = extractExtensionFromFileKey(
    blendBucketFileKeys.withoutBg
  );

  const randomStr = nanoid(4);

  return {
    original: `${heroImageId}-${randomStr}.${originalFileExt}`,
    withoutBg: `${heroImageId}-${randomStr}-bg-removed.${bgRemovedFileExt}`,
    thumbnail: `${heroImageId}-${randomStr}-thumbnail.${bgRemovedFileExt}`,
  } as ExtendedHeroImageFileKeys;
};
