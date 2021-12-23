import type { NextApiRequest, NextApiResponse } from "next";

import Joi from "joi";

import { _getBlend } from "../[id]";
import { Blend } from "server/base/models/blend";
import { handleServerExceptions, UserError } from "server/base/errors";
import { doesObjectExist, getObject, uploadObject } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import ToolkitApi, { ToolkitErrorResponse } from "server/internal/toolkit";
import axios from "axios";
import { applyMask, rescaleImage } from "server/helpers/imageUtils";
import { bufferToStream, streamToBuffer } from "server/helpers/bufferUtils";
import sharp from "sharp";

const toolkitApi = new ToolkitApi();

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

    const fileKeyParts = fileKey.split("/");

    const [fileNameWithExt] = fileKeyParts.slice(-1);

    const fileNameWithoutExt = fileNameWithExt.split(".").slice(0, -1).join("");

    const bgRemovedFileName = `${fileNameWithoutExt}-bg-removed.png`;

    const bgMaskFileName = `${fileNameWithoutExt}-bg-mask.png`;

    const bgRemovedFileKey = [
      ...fileKeyParts.slice(0, -1),
      "/",
      bgRemovedFileName,
    ].join("");

    const bgMaskFileKey = [
      ...fileKeyParts.slice(0, -1),
      "/",
      bgMaskFileName,
    ].join("");

    const bgRemovedElementExists = await doesObjectExist(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgRemovedFileKey
    );

    if (!bgRemovedElementExists) {
      // As of now this logic just works by assuming file name is unique
      // This works because we generate a random file name when we store the file name
      // Re-evaluate in the future
      try {
        const bgRemoved = await toolkitApi.removeBg(
          originalImage,
          fileNameWithExt,
          true,
          useMask
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
            bufferToStream(bgRemovedImageUsingMask)
          );
        } else {
          await uploadObject(
            ConfigProvider.BLEND_INGREDIENTS_BUCKET,
            bgRemovedFileKey,
            bgRemoved
          );
        }
      } catch (ex) {
        if (axios.isAxiosError(ex)) {
          let data = "";
          for await (const chunk of ex.response.data) {
            data += chunk;
          }
          let error: ToolkitErrorResponse = JSON.parse(data);

          let errorMessage = error.message;

          if (error.code == "unknown_foreground") {
            errorMessage = "Unable to remove background";
          }

          throw new UserError(errorMessage, error.code);
        }
        throw ex;
      }
    }

    res.send({
      original: fileKey,
      withoutBg: bgRemovedFileKey,
      mask: useMask ? bgMaskFileKey : null,
    });
  });
};
