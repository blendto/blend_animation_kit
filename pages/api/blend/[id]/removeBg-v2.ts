import type { NextApiResponse } from "next";

import Joi from "joi";

import { Blend } from "server/base/models/blend";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import {
  deleteObject,
  doesObjectExist,
  getObject,
  uploadObject,
} from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import { RemoveBgService } from "server/internal/remove-bg-service";
import {
  applyMask,
  convertImageToWebp,
  readImageMetadata,
  rescaleImage,
} from "server/helpers/imageUtils";
import { bufferToStream } from "server/helpers/bufferUtils";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import logger from "server/base/Logger";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { sharpInstance } from "server/helpers/sharpUtils";
import {
  BgRemovalMetadata,
  ClassificationMetadata,
  BgRemovedFileKeys,
  RemoveBGSource,
} from "server/base/models/removeBg";
import RecoEngineApi from "server/internal/reco-engine";
import sharp from "sharp";
import { BlendHeroImage, ImageFileKeys } from "server/base/models/heroImage";
import { fireAndForget } from "server/helpers/async-runner";
import HeroImageService from "server/service/heroImage";
import { plainToClass } from "class-transformer";

const removeBgService = diContainer.get<RemoveBgService>(TYPES.RemoveBgService);
const blendService = diContainer.get<BlendService>(TYPES.BlendService);
const heroImageService = diContainer.get<HeroImageService>(
  TYPES.HeroImageService
);
const recoEngineApi = new RecoEngineApi();

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(removeBgAndStore, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

interface RemoveBgRequest {
  fileKey: string;
  useMask: boolean;
  crop: boolean;
  isHeroImage: boolean;
  userChosenSuperClass?: string;
}

export const RemoveBgRequestSchema = Joi.object({
  fileKey: Joi.string().required(),
  useMask: Joi.bool().default(true),
  crop: Joi.bool().default(true),
  isHeroImage: Joi.bool().default(false),
  userChosenSuperClass: Joi.string().when("isHeroImage", {
    is: false,
    then: Joi.forbidden(),
  }),
});

async function generateBgRemovedImageFromMaskAndUpload(
  originalImage: Buffer,
  maskImage: Buffer,
  bgMaskFileKey: string,
  bgRemovedFileKey: string
) {
  const bgRemovedImageUsingMask = await applyMask(originalImage, maskImage);
  await uploadObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    bgMaskFileKey,
    bufferToStream(maskImage)
  );

  await uploadObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    bgRemovedFileKey,
    bufferToStream(bgRemovedImageUsingMask.data)
  );

  return bgRemovedImageUsingMask;
}

async function checkIfRetriggerNeeded(
  blend: Blend,
  userChosenSuperClass: string
): Promise<boolean> {
  const classificationMetadata = plainToClass(
    ClassificationMetadata,
    blend.heroImages?.classificationMetadata
  );
  const previousClass =
    classificationMetadata?.userChosenSuperClass ??
    classificationMetadata?.productSuperClass;
  if (!previousClass) return false;
  const shouldRetriggerBgRemoval =
    await removeBgService.shouldRetriggerBgRemoval(
      previousClass,
      userChosenSuperClass
    );
  return shouldRetriggerBgRemoval.isRetriggerRequired;
}

const MAX_SIZE_ALLOWED = 1024 * 1024 * 10;

async function compressImageToWebp(
  originalImage: Buffer,
  metadata: sharp.Metadata
) {
  if (
    !["jpeg", "jpg"].includes(metadata.format) ||
    metadata.size > MAX_SIZE_ALLOWED
  ) {
    originalImage = await convertImageToWebp(originalImage, 90);
    const sharpInst = await sharpInstance(originalImage);
    const compressedImageMetadata = await sharpInst.metadata();
    logger.info({
      op: "RESIZE_IMAGE",
      originalImageSize: metadata.size,
      compressedImageSize: compressedImageMetadata.size,
    });

    if (compressedImageMetadata.size > MAX_SIZE_ALLOWED) {
      throw new UserError("Image too big in size");
    }
  }
  return originalImage;
}

async function removeBgAndClassifyIfHero(
  originalImage: Buffer,
  fileKeys: BgRemovedFileKeys,
  options: RemoveBgRequest
): Promise<{
  bgRemovalOutput: { buffer: Buffer; metadata: BgRemovalMetadata };
  classificationMetadata?: ClassificationMetadata;
}> {
  const fileKeyParts = options.fileKey.split("/");

  const [fileNameWithExt] = fileKeyParts.slice(-1);

  const { crop, userChosenSuperClass, useMask, isHeroImage } = options;
  // As of now this logic just works by assuming file name is unique
  // This works because we generate a random file name when we store the file name
  // Re-evaluate in the future
  const bgRemovalFuture = removeBgService.removeBg(
    originalImage,
    fileNameWithExt,
    crop,
    useMask,
    {
      source: RemoveBGSource.BLEND,
      fileKeys,
    },
    userChosenSuperClass
  );
  let identifyCategoryFuture: Promise<ClassificationMetadata | undefined> =
    Promise.resolve(undefined) as Promise<undefined>;

  if (isHeroImage) {
    identifyCategoryFuture = recoEngineApi.detectProductCategory(fileKeys);
  }
  const promises = await Promise.all([bgRemovalFuture, identifyCategoryFuture]);
  return { bgRemovalOutput: promises[0], classificationMetadata: promises[1] };
}

async function saveOrUpdateHeroImageDB(
  blend: Blend,
  uid: string,
  imageFileKeysItem: ImageFileKeys | BlendHeroImage
): Promise<void> {
  if (!blend.heroImages?.heroImageId) {
    const heroImage = await heroImageService.createNewImage(
      blend.id,
      uid,
      imageFileKeysItem
    );
    await blendService.addOrUpdateImageFileKeys(
      blend,
      {
        ...blend.heroImages,
        heroImageId: heroImage.id,
      },
      { isHeroImage: true }
    );
  } else {
    const { heroImageId } = blend.heroImages;
    await heroImageService.updateBgRemoved(
      heroImageId,
      blend.id,
      uid,
      imageFileKeysItem
    );
  }
}

const removeBgAndStore = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const body = req.body as RemoveBgRequest;
  const { id } = req.query;

  const blend: Blend = await blendService.getBlend(id as string);

  if (!blend) {
    throw new UserError("Blend not found");
  }

  validate(body, requestComponentToValidate.body, RemoveBgRequestSchema);

  const fileKeysToDelete: string[] = [];

  const {
    fileKey,
    useMask = true,
    isHeroImage = false,
    userChosenSuperClass,
  } = body;

  let originalImage: Buffer;
  const fetchedBuffer = await getObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    fileKey
  );
  originalImage = await (await sharpInstance(fetchedBuffer)).toBuffer();

  const { bgRemovedFileKey, bgMaskFileKey } =
    RemoveBgService.constructBgRemovedFileKey(fileKey, {
      superClass: userChosenSuperClass,
    });

  const bgRemovedElementExists = await doesObjectExist(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    bgRemovedFileKey
  );

  const fileKeys: BgRemovedFileKeys = {
    original: fileKey,
    withoutBg: bgRemovedFileKey,
  };

  let imageFileKeysItem: ImageFileKeys | BlendHeroImage = { ...fileKeys };

  const metadata = await readImageMetadata(originalImage);
  if (isHeroImage && userChosenSuperClass) {
    const shouldRemoveBg = await checkIfRetriggerNeeded(
      blend,
      userChosenSuperClass
    );
    if (!shouldRemoveBg) {
      const classificationMetadata = plainToClass(ClassificationMetadata, {
        ...blend.heroImages?.classificationMetadata,
        userChosenSuperClass,
      });
      const blendHero = { ...blend.heroImages, classificationMetadata };
      await blendService.addOrUpdateImageFileKeys(blend, blendHero, {
        isHeroImage: true,
      });
      return res.send({ fileKeys: blend.heroImages, classificationMetadata });
    }
    if (bgRemovedFileKey !== blend.heroImages.withoutBg) {
      fileKeysToDelete.push(blend.heroImages?.withoutBg);
      fileKeysToDelete.push(blend.heroImages?.mask);
    }
  }

  if (bgRemovedElementExists) {
    const imageFileKeysInBlend = blend.imageFileKeys.find(
      (fileKeys) => fileKeys.original === fileKey
    );
    return res.send({
      fileKeys: {
        original: fileKey,
        withoutBg: bgRemovedFileKey,
        mask: useMask ? bgMaskFileKey : null,
        ...imageFileKeysInBlend,
      },
    });
  }

  originalImage = await compressImageToWebp(originalImage, metadata);
  const bgRemovalAndClassifyOutput = await removeBgAndClassifyIfHero(
    originalImage,
    fileKeys,
    body
  );
  const { bgRemovalOutput, classificationMetadata } =
    bgRemovalAndClassifyOutput;
  const bgRemovalMetadata = bgRemovalOutput.metadata;
  let trimLTWH: Array<number> | null = null;

  imageFileKeysItem = { ...fileKeys, classificationMetadata };

  if (useMask) {
    const { width, height } = metadata;
    const rescaledMask = await rescaleImage(bgRemovalOutput.buffer, {
      width,
      height,
    });
    const bgRemovedImageUsingMask =
      await generateBgRemovedImageFromMaskAndUpload(
        originalImage,
        rescaledMask,
        bgMaskFileKey,
        bgRemovedFileKey
      );

    const {
      trimOffsetLeft,
      trimOffsetTop,
      width: trimWidth,
      height: trimHeight,
    } = bgRemovedImageUsingMask.info;

    if (trimOffsetLeft) {
      trimLTWH = [
        Math.abs(trimOffsetLeft) || 0,
        Math.abs(trimOffsetTop) || 0,
        trimWidth,
        trimHeight,
      ];
    } else {
      // trimming failed
      trimLTWH = null;
    }

    imageFileKeysItem = {
      ...imageFileKeysItem,
      mask: bgMaskFileKey,
      trimLTWH,
      classificationMetadata,
    } as ImageFileKeys | BlendHeroImage;
  } else {
    await uploadObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgRemovedFileKey,
      bgRemovalOutput.buffer
    );
  }

  await blendService.addOrUpdateImageFileKeys(blend, imageFileKeysItem, {
    isHeroImage: isHeroImage || blend.heroImages?.original === fileKey,
  });

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  fireAndForget(async () => {
    const promises = fileKeysToDelete.map((fileKey) => {
      if (fileKey) {
        return deleteObject(ConfigProvider.BLEND_INGREDIENTS_BUCKET, fileKey);
      }
      return Promise.resolve();
    });
    return Promise.all(promises);
  });

  if (isHeroImage) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fireAndForget(() =>
      saveOrUpdateHeroImageDB(blend, req.uid, imageFileKeysItem)
    );
  }

  res.send({
    fileKeys: {
      original: fileKey,
      withoutBg: bgRemovedFileKey,
      mask: useMask ? bgMaskFileKey : null,
      trimLTWH,
    },
    classificationMetadata,
    qualityConfidence: bgRemovalMetadata?.qualityConfidence,
  });
};
