import { nanoid } from "nanoid";

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

export interface HeroImageFileKeys {
  original: string;
  withoutBg?: string;
}

export interface ExtendedHeroImageFileKeys extends HeroImageFileKeys {
  thumbnail?: string;
}

const extractExtensionFromFileKey = (fileKey: String): String => {
  return fileKey.split(".").pop();
};

export const createBlendBucketFileKeys = (
  blendId: String,
  heroImage: HeroImage
): HeroImageFileKeys => {
  const randomId = nanoid(16);
  const originalFileExt = extractExtensionFromFileKey(heroImage.original);
  const bgRemovedFileExt = extractExtensionFromFileKey(heroImage.withoutBg);
  return {
    original: `${blendId}/${randomId}.${originalFileExt}`,
    withoutBg: `${blendId}/${randomId}-bg-removed.${bgRemovedFileExt}`,
  } as HeroImageFileKeys;
};

export const createHeroBucketFileKeys = (
  heroImageId: String,
  blendBucketFileKeys: HeroImageFileKeys
): ExtendedHeroImageFileKeys => {
  const originalFileExt = extractExtensionFromFileKey(
    blendBucketFileKeys.original
  );
  const bgRemovedFileExt = extractExtensionFromFileKey(
    blendBucketFileKeys.withoutBg
  );

  return {
    original: `${heroImageId}.${originalFileExt}`,
    withoutBg: `${heroImageId}-bg-removed.${bgRemovedFileExt}`,
    thumbnail: `${heroImageId}-thumbnail.${bgRemovedFileExt}`,
  } as ExtendedHeroImageFileKeys;
};
