import type { NextApiResponse } from "next";
import sharp from "sharp";

import {
  RemoveBgService,
  RemoveBGSource,
} from "server/internal/remove-bg-service";

import ConfigProvider from "server/base/ConfigProvider";
import {
  copyObject,
  doesObjectExist,
  getObject,
  uploadObject,
} from "server/external/s3";
import { UserError } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import axios from "axios";
import {
  createBlendBucketFileKeys,
  HeroImage,
  HeroImageFileKeys,
} from "server/base/models/heroImage";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import HeroImageService from "server/service/heroImage";
import { SuggestionService } from "server/service/suggestion";
import logger from "server/base/Logger";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { fireAndForget } from "server/helpers/async-runner";

const removeBgService = diContainer.get<RemoveBgService>(TYPES.RemoveBgService);

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return suggestRecipes(req, res);
      default:
        res.status(405).end();
    }
  }
);

interface SuggestRecipesRequestBody {
  fileKeys: HeroImageFileKeys;
  multipleAspectRatios?: boolean;
  heroImageId?: string;
}

async function createBgRemovedImage(
  originalImage: Buffer,
  fileNameWithExt: string,
  fileKeys: HeroImageFileKeys,
  bgRemovedFileKey: string
) {
  {
    logger.info({
      fileNameWithExt,
      fileKeys,
    });
    const metadata = await sharp(originalImage).metadata();

    if (
      !["jpeg", "jpg"].includes(metadata.format) ||
      metadata.size > 1024 * 1024 * 10
    ) {
      logger.info({ format: metadata.format });

      // failOnError: false helps blow past errors like
      // "VipsJpeg: Invalid SOS parameters for sequential JPEG"
      // https://github.com/lovell/sharp/issues/1578
      originalImage = await sharp(originalImage, { failOnError: false })
        .resize({
          width: 3840,
          height: 3840,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat("jpeg")
        .toBuffer();
      const resizedImageMetadata = await sharp(originalImage).metadata();
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
          message: ex.response?.data ?? "No response",
        });

        throw new UserError(
          "Something went wrong while removing background! Try again!"
        );
      }
      throw ex;
    }
  }
}

const suggestRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
    body,
  } = req;

  const { fileKeys, multipleAspectRatios, heroImageId } =
    body as SuggestRecipesRequestBody;

  const blend: Blend = await diContainer
    .get<BlendService>(TYPES.BlendService)
    .getBlend(id as string);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  if (
    !heroImageId &&
    (!fileKeys || typeof fileKeys != "object" || !fileKeys.original)
  ) {
    res.status(400).send({ message: "Invalid filekeys / heroImageId" });
    return;
  }

  const ip = req.headers["x-forwarded-for"] as string;

  const fileKeysProcessor = FileKeysProcessingStrategy.choose(
    id as string,
    req.uid,
    fileKeys,
    heroImageId
  );

  const finalisedFileKeys: HeroImageFileKeys =
    await fileKeysProcessor.process();

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  await blendService.addHeroKeysToBlend(blend.id, finalisedFileKeys);
  const suggestions = await diContainer
    .get<SuggestionService>(TYPES.SuggestionService)
    .suggestRecipes(
      req.uid,
      finalisedFileKeys.withoutBg,
      ip,
      multipleAspectRatios
    );

  return res.send({
    fileKeys: finalisedFileKeys,
    suggestedRecipes: suggestions.randomTemplates,
    otherRecipes: suggestions.recipeLists,
  });
};

abstract class FileKeysProcessingStrategy {
  static choose(
    blendId: String,
    userId: String,
    fileKeys?: HeroImageFileKeys,
    heroImageId?: String
  ): FileKeysProcessingStrategy {
    if (heroImageId) {
      return new HeroImageIdBased(heroImageId, blendId, userId);
    }
    return new HeroImageFileKeysBased(fileKeys, blendId, userId);
  }

  abstract process(): Promise<HeroImageFileKeys>;
}

class HeroImageIdBased extends FileKeysProcessingStrategy {
  heroImageId: String;
  blendId: String;
  userId: String;
  constructor(heroImageId: String, blendId: String, userId: String) {
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
      this.heroImageId as string,
      this.userId as string
    );
    if (!heroImage) {
      throw new UserError("No such hero image for user");
    }
    const blendBucketFilekeys = createBlendBucketFileKeys(
      this.blendId,
      heroImage
    );

    const copyOriginalFile: Promise<any> = copyObject(
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroImage.original,
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      blendBucketFilekeys.original
    );

    const copyBgRemovedFile: Promise<any> = copyObject(
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

class HeroImageFileKeysBased extends FileKeysProcessingStrategy {
  fileKeys: HeroImageFileKeys;
  blendId: String;
  userId: String;
  constructor(fileKeys: HeroImageFileKeys, blendId: String, userId: String) {
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
      // noinspection ES6MissingAwait
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
      let originalImage: Buffer = await getObject(
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

    // noinspection ES6MissingAwait
    fireAndForget(() =>
      heroImageService.createNewImage(this.blendId, this.userId, this.fileKeys)
    );
    return updatedFilekeys;
  }
}
