import type { NextApiResponse } from "next";

import Joi from "joi";

import { Blend, BlendVersion } from "server/base/models/blend";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import {
  createDestinationFileKey,
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
  convertUnspportedFormatToWebp,
  createConvertedFileKey,
  getTargetDimensions,
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
import {
  ALL_SUPPORTED_EXTENSIONS,
  MAX_IMAGE_DIMENSION,
  VALID_UPLOAD_IMAGE_EXTENSIONS,
} from "server/helpers/constants";
import { plainToClass } from "class-transformer";
import { Rect } from "server/helpers/rect";
import { extractCorrectedFileName } from "server/helpers/fileKeyUtils";

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

interface EncodedImageRemoveBgRequest {
  encodedImage: string;
  fileName: string;
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

export const EncodedImageRemoveBgRequestSchema = Joi.object({
  encodedImage: Joi.string().required(),
  fileName: Joi.string().required(),
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
  bgRemovedFileKey: string,
  crop?: Rect
) {
  const bgRemovedImageUsingMask = await applyMask(
    originalImage,
    maskImage,
    crop
  );

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
      logger.warn({
        op: "IMAGE_TOO_LARGE",
        originalImageSize: metadata.size,
        compressedImageSize: compressedImageMetadata.size,
      });
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

function validateRequest(body: object) {
  if ((body as RemoveBgRequest).fileKey) {
    validate(body, requestComponentToValidate.body, RemoveBgRequestSchema);
  }
  if ((body as EncodedImageRemoveBgRequest).encodedImage) {
    validate(
      body,
      requestComponentToValidate.body,
      EncodedImageRemoveBgRequestSchema
    );
  }
}

async function processRequestBody(
  blendId: string,
  body: object
): Promise<RemoveBgRequest> {
  if ((body as RemoveBgRequest).fileKey) {
    return body as RemoveBgRequest;
  }
  const {
    encodedImage,
    fileName,
    isHeroImage,
    useMask,
    crop,
    userChosenSuperClass,
  } = body as EncodedImageRemoveBgRequest;
  const correctedFileName = extractCorrectedFileName(fileName);
  const fileKey = createDestinationFileKey(
    correctedFileName.trim(),
    ALL_SUPPORTED_EXTENSIONS,
    blendId + "/"
  );
  await uploadObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    fileKey,
    bufferToStream(Buffer.from(encodedImage, "base64"))
  );
  return {
    fileKey,
    isHeroImage,
    useMask,
    crop,
    userChosenSuperClass,
  };
}

const removeBgAndStore = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query;

  const blend: Blend = await blendService.getBlend(
    id as string,
    BlendVersion.current,
    true
  );

  if (!blend) {
    throw new UserError("Blend not found");
  }

  validateRequest(req.body as object);

  const fileKeysToDelete: string[] = [];

  const body = await processRequestBody(id as string, req.body as object);
  const { useMask = true, isHeroImage = false, userChosenSuperClass } = body;
  let { fileKey } = body;

  let originalImage: Buffer;
  let fetchedBuffer = await getObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    fileKey
  );
  const fileKeyParts = fileKey.split("/");
  const [fileNameWithExt] = fileKeyParts.slice(-1);
  const fileNameArr = fileNameWithExt.split(".");
  let fileExtension = fileNameArr.pop();
  let fileNameWithoutExt = fileNameArr.join(".");
  if (fileNameArr.length <= 1) {
    // No extension in the filename
    fileNameWithoutExt = fileExtension;
    fileExtension = "";
  }
  if (fileExtension && !VALID_UPLOAD_IMAGE_EXTENSIONS.includes(fileExtension)) {
    // if the fetched image is in an unsupported format,
    // we change things to make it look like the fetched image was a webp
    fetchedBuffer = await convertUnspportedFormatToWebp(
      fetchedBuffer,
      fileKeyParts[1],
      fileKeyParts[0]
    );
    fileKey = createConvertedFileKey(fileKeyParts[0], fileNameWithoutExt);
    await uploadObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      fileKey,
      bufferToStream(fetchedBuffer)
    ).catch((err) => {
      throw new Error(`uploading file ${fileKey} failed`);
    });
  }
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

  let metadata = await readImageMetadata(fetchedBuffer);
  const targetDimensions: [number, number] = getTargetDimensions(
    metadata.width,
    metadata.height,
    MAX_IMAGE_DIMENSION
  );
  originalImage = await (await sharpInstance(fetchedBuffer, {}, fileExtension))
    .resize(targetDimensions[0], targetDimensions[1])
    .toBuffer();
  metadata = await readImageMetadata(originalImage);
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
    const { cropBoundaries } = bgRemovalMetadata;
    const bgRemovedImageUsingMask =
      await generateBgRemovedImageFromMaskAndUpload(
        originalImage,
        rescaledMask,
        bgMaskFileKey,
        bgRemovedFileKey,
        cropBoundaries
      );

    if (cropBoundaries) {
      trimLTWH = cropBoundaries.toLTWH();
    } else {
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
      }
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
