import type { NextApiRequest, NextApiResponse } from "next";

import Joi from "joi";

import { Blend } from "server/base/models/blend";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import { doesObjectExist, getObject, uploadObject } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import {
  RemoveBgService,
  RemoveBGSource,
} from "server/internal/remove-bg-service";
import {
  applyMask,
  convertImageToWebp,
  rescaleImage,
} from "server/helpers/imageUtils";
import { bufferToStream } from "server/helpers/bufferUtils";
import sharp from "sharp";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import logger from "server/base/Logger";
import { withReqHandler } from "server/helpers/request";

const removeBgService = diContainer.get<RemoveBgService>(TYPES.RemoveBgService);

export default withReqHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return removeBgAndStore(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

interface RemoveBgRequest {
  fileKey: string;
  useMask: boolean;
  forceSelf: boolean;
  crop: boolean;
}

export const RemoveBgRequestSchema = Joi.object({
  fileKey: Joi.string().required(),
  useMask: Joi.bool().default(false),
  crop: Joi.bool().default(true),
});

const removeBgAndStore = async (req: NextApiRequest, res: NextApiResponse) => {
  const body = req.body as RemoveBgRequest;
  const { id } = req.query;

  const blend: Blend = await diContainer
    .get<BlendService>(TYPES.BlendService)
    .getBlend(id as string);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  const { error } = RemoveBgRequestSchema.validate(body);

  if (error) {
    res.status(400).send({ message: error.details[0].message });
    return;
  }

  const { fileKey, useMask = false, crop = true } = body;

  let originalImage: Buffer;
  originalImage = await getObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    fileKey
  );

  const { bgRemovedFileKey, bgMaskFileKey, fileNameWithExt } =
    RemoveBgService.constructBgRemovedFileKey(fileKey);

  let trimLTWH: Array<number> | null = null;

  const bgRemovedElementExists = await doesObjectExist(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    bgRemovedFileKey
  );

  if (!bgRemovedElementExists) {
    const metadata = await sharp(originalImage).metadata();

    if (
      !["jpeg", "jpg"].includes(metadata.format) ||
      metadata.size > 1024 * 1024 * 10
    ) {
      originalImage = await convertImageToWebp(originalImage, 90);
      const compressedImageMetadata = await sharp(originalImage).metadata();
      logger.info({
        op: "RESIZE_IMAGE",
        originalImageSize: metadata.size,
        compressedImageSize: compressedImageMetadata.size,
      });

      if (compressedImageMetadata.size > 1024 * 1024 * 10) {
        throw new UserError("Image too big in size");
      }
    }
    // As of now this logic just works by assuming file name is unique
    // This works because we generate a random file name when we store the file name
    // Re-evaluate in the future
    const bgRemoved = await removeBgService.removeBg(
      originalImage,
      fileNameWithExt,
      crop,
      useMask,
      {
        source: RemoveBGSource.BLEND,
        fileKeys: {
          original: fileKey,
          withoutBg: bgRemovedFileKey,
        },
      }
    );

    if (useMask) {
      const { width, height } = await sharp(originalImage).metadata();
      const rescaledMask = await rescaleImage(bgRemoved, { width, height });
      const bgRemovedImageUsingMask = await applyMask(
        originalImage,
        rescaledMask
      );

      await uploadObject(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        bgMaskFileKey,
        bufferToStream(rescaledMask)
      );

      await uploadObject(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        bgRemovedFileKey,
        bufferToStream(bgRemovedImageUsingMask.data)
      );

      const {
        trimOffsetLeft,
        trimOffsetTop,
        width: trimWidth,
        height: trimHeight,
      } = bgRemovedImageUsingMask.info;
      trimLTWH = [trimOffsetLeft, trimOffsetTop, trimWidth, trimHeight];
    } else {
      await uploadObject(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        bgRemovedFileKey,
        bgRemoved
      );
    }
  }

  res.send({
    original: fileKey,
    withoutBg: bgRemovedFileKey,
    mask: useMask ? bgMaskFileKey : null,
    trimLTWH,
  });
};
