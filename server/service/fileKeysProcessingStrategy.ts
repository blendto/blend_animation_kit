import {
  createBlendBucketFileKeys,
  HeroImage,
  HeroImageFileKeys,
} from "server/base/models/heroImage";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { UserError } from "server/base/errors";
import {
  copyObject,
  doesObjectExist,
  getObject,
  uploadObject,
} from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import { fireAndForget } from "server/helpers/async-runner";
import { RemoveBgService } from "server/internal/remove-bg-service";
import logger from "server/base/Logger";
import axios from "axios";
import HeroImageService from "server/service/heroImage";
import { sharpInstance } from "server/helpers/sharpUtils";
import { RemoveBGSource } from "server/base/models/removeBg";

export abstract class FileKeysProcessingStrategy {
  static choose(
    blendId: string,
    userId: string,
    fileKeys?: HeroImageFileKeys,
    heroImageId?: string
  ): FileKeysProcessingStrategy {
    if (heroImageId) {
      return new HeroImageIdBased(heroImageId, blendId, userId);
    }
    return new HeroImageFileKeysBased(fileKeys, blendId, userId);
  }

  abstract process(): Promise<HeroImageFileKeys>;
}

export class HeroImageIdBased extends FileKeysProcessingStrategy {
  heroImageId: string;
  blendId: string;
  userId: string;
  constructor(heroImageId: string, blendId: string, userId: string) {
    super();
    this.heroImageId = heroImageId;
    this.blendId = blendId;
    this.userId = userId;
  }

  async process(): Promise<HeroImageFileKeys> {
    const heroImageService = diContainer.get<HeroImageService>(
      TYPES.HeroImageService
    );

    const heroImage: HeroImage | null = await heroImageService.getImage(
      this.heroImageId,
      this.userId
    );
    if (!heroImage) {
      throw new UserError("No such hero image for user");
    }
    const blendBucketFilekeys = createBlendBucketFileKeys(
      this.blendId,
      heroImage
    );

    const copyOriginalFile: Promise<unknown> = copyObject(
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroImage.original,
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      blendBucketFilekeys.original
    );

    const copyBgRemovedFile: Promise<unknown> = copyObject(
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroImage.withoutBg,
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      blendBucketFilekeys.withoutBg
    );

    await Promise.all([copyOriginalFile, copyBgRemovedFile]);

    await heroImageService.markImageUsage(this.heroImageId);
    return blendBucketFilekeys;
  }
}

export class HeroImageFileKeysBased extends FileKeysProcessingStrategy {
  fileKeys: HeroImageFileKeys;
  blendId: string;
  userId: string;
  constructor(fileKeys: HeroImageFileKeys, blendId: string, userId: string) {
    super();
    this.fileKeys = fileKeys;
    this.blendId = blendId;
    this.userId = userId;
  }

  async process(): Promise<HeroImageFileKeys> {
    const heroImageService = diContainer.get<HeroImageService>(
      TYPES.HeroImageService
    );

    if (this.fileKeys.withoutBg) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fireAndForget(() =>
        heroImageService.createNewImage(
          this.blendId,
          this.userId,
          this.fileKeys
        )
      );
      return this.fileKeys;
    }

    const { bgRemovedFileKey, fileNameWithExt } =
      RemoveBgService.constructBgRemovedFileKey(this.fileKeys.original);

    // As of now this logic just works by assuming file name is unique
    // This works because we generate a random file name when we store the file name
    // Re-evaluate in the future
    const bgRemovedElementExists = await doesObjectExist(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgRemovedFileKey
    );

    if (!bgRemovedElementExists) {
      const originalImage: Buffer = await getObject(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        this.fileKeys.original
      );
      await createBgRemovedImage(
        originalImage,
        fileNameWithExt,
        this.fileKeys,
        bgRemovedFileKey
      );
    }

    const updatedFilekeys = {
      original: this.fileKeys.original,
      withoutBg: bgRemovedFileKey,
    } as HeroImageFileKeys;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fireAndForget(() =>
      heroImageService.createNewImage(
        this.blendId,
        this.userId,
        updatedFilekeys
      )
    );
    return updatedFilekeys;
  }
}

async function createBgRemovedImage(
  originalImage: Buffer,
  fileNameWithExt: string,
  fileKeys: HeroImageFileKeys,
  bgRemovedFileKey: string
) {
  logger.info({
    fileNameWithExt,
    fileKeys,
  });
  const metadata = await (await sharpInstance(originalImage)).metadata();

  if (
    !["jpeg", "jpg"].includes(metadata.format) ||
    metadata.size > 1024 * 1024 * 10
  ) {
    logger.info({ format: metadata.format });

    // failOnError: false helps blow past errors like
    // "VipsJpeg: Invalid SOS parameters for sequential JPEG"
    // https://github.com/lovell/sharp/issues/1578
    const sharpInst = await sharpInstance(originalImage, {
      failOnError: false,
    });
    originalImage = await sharpInst
      .resize({
        width: 3840,
        height: 3840,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat("jpeg")
      .toBuffer();
    const resizedImageMetadata = await (
      await sharpInstance(originalImage)
    ).metadata();
    logger.info({
      op: "BlendSuggest.ResizeImage",
      sourceSize: metadata.size,
      finalSize: resizedImageMetadata.size,
      sourceDimensions: { width: metadata.width, height: metadata.height },
      finalDimensions: {
        width: resizedImageMetadata.width,
        height: resizedImageMetadata.height,
      },
    });
  }

  const removeBgService = diContainer.get<RemoveBgService>(
    TYPES.RemoveBgService
  );
  const bgRemoved = await removeBgService.removeBg(
    originalImage,
    fileNameWithExt,
    true,
    false,
    {
      source: RemoveBGSource.BLEND,
      fileKeys: {
        original: fileKeys.original,
        withoutBg: bgRemovedFileKey,
      },
    }
  );

  try {
    await uploadObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgRemovedFileKey,
      bgRemoved
    );
  } catch (ex) {
    if (axios.isAxiosError(ex)) {
      logger.error({
        code: "BlendSuggest.S3UploadFailed",
        statusCode: ex.response.status,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: ex.response?.data ?? "No response",
      });

      throw new UserError(
        "Something went wrong while removing background! Try again!"
      );
    }
    throw ex;
  }
}
