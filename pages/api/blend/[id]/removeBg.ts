import type { NextApiRequest, NextApiResponse } from "next";

import Joi from "joi";

import { _getBlend } from "../[id]";
import { Blend } from "server/base/models/blend";
import { handleServerExceptions, UserError } from "server/base/errors";
import { doesObjectExist, getObject, uploadObject } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import {
  RemoveBgService,
  RemoveBGSource,
} from "server/internal/remove-bg-service";
import { applyMask, rescaleImage } from "server/helpers/imageUtils";
import { bufferToStream, streamToBuffer } from "server/helpers/bufferUtils";
import sharp from "sharp";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";

const removeBgService = diContainer.get<RemoveBgService>(TYPES.RemoveBgService);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await removeBgAndStore(req, res);
      break;
    default:
      return res.status(404).json({ code: 404, message: "Wrong page/method" });
  }
};

interface RemoveBgRequest {
  fileKey: string;
  useMask: boolean;
}

export const RemoveBgRequestSchema = Joi.object({
  fileKey: Joi.string().required(),
  useMask: Joi.bool().default(false),
});

const removeBgAndStore = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id },
    body,
  } = req;

  const blend: Blend = await _getBlend(id as string);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  const { error } = RemoveBgRequestSchema.validate(body);

  if (error) {
    res.status(400).send({ message: error.details[0].message });
    return;
  }

  const { fileKey, useMask = false } = body as RemoveBgRequest;

  let originalImage: Buffer;
  return await handleServerExceptions(res, async () => {
    originalImage = await getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      fileKey
    );

    const { bgRemovedFileKey, bgMaskFileKey, fileNameWithExt } =
      RemoveBgService.constructBgRemovedFileKey(fileKey);

    var trimLTWH: Array<Number> | null = null;

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
        // failOnError: false helps blow past errors like
        // "VipsJpeg: Invalid SOS parameters for sequential JPEG"
        // https://github.com/lovell/sharp/issues/1578
        originalImage = await sharp(originalImage, { failOnError: false })
          .toFormat("webp", { quality: 90 })
          .toBuffer();
        const compressedImageMetadata = await sharp(originalImage).metadata();
        console.info({
          op: "RESIZE_IMAGE",
          originalImageSize: metadata.size,
          compressedImageSize: compressedImageMetadata.size,
        });

        if (compressedImageMetadata.size > 1024 * 1024 * 10) {
          throw new UserError("Image too big in size", 400);
        }
      }
      // As of now this logic just works by assuming file name is unique
      // This works because we generate a random file name when we store the file name
      // Re-evaluate in the future
      const bgRemoved = await removeBgService.removeBg(
        originalImage,
        fileNameWithExt,
        true,
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
        const rescaledMask = await rescaleImage(
          await streamToBuffer(bgRemoved),
          width,
          height
        );
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
  });
};
