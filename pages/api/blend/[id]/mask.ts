import type { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import Joi from "joi";
import { HeroImageFileKeys } from "server/base/models/heroImage";
import FileKeysService from "server/service/fileKeys";
import { RemoveBgService } from "server/internal/remove-bg-service";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "GET":
        await ensureAuth(getMask, req, res);
        break;
      case "POST":
        await ensureAuth(updateMask, req, res);
        break;
      default:
        throw new MethodNotAllowedError();
    }
  }
);

export const UpdateMaskRequestSchema = Joi.object({
  maskFileKey: Joi.string().required(),
  originalFileKey: Joi.string().required(),
});

const updateMask = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };

  const { error } = UpdateMaskRequestSchema.validate(req.body);

  if (error) {
    throw new UserError(error.message);
  }

  const { maskFileKey, originalFileKey } = req.body as {
    maskFileKey: string;
    originalFileKey: string;
  };

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const removeBgService = diContainer.get<RemoveBgService>(
    TYPES.RemoveBgService
  );

  const blend = await blendService.getBlend(id, null, true);

  const bgRemovedImageFileKey = await removeBgService.applyMaskAndUpload(
    originalFileKey,
    maskFileKey
  );

  const fileKeyItem = {
    original: originalFileKey,
    mask: maskFileKey,
    withoutBg: bgRemovedImageFileKey,
  } as HeroImageFileKeys;

  await blendService.addOrUpdateImageFileKeys(blend, fileKeyItem, {
    isHeroImage: blend.heroImages?.original === originalFileKey,
  });

  return res.send(fileKeyItem);
};

const getMask = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const { id, fileKey } = req.query as {
    id: string;
    fileKey: string;
  };
  if (!fileKey) throw new UserError("`fileKey` is required");

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const fileKeysService = diContainer.get<FileKeysService>(
    TYPES.FileKeysService
  );

  const blend = await blendService.getBlend(id);

  const imageFileKeyItem = fileKeysService.retrieveFileKeyItemFromBlend(
    blend,
    fileKey
  );

  if (!imageFileKeyItem || !imageFileKeyItem?.mask) {
    const bgMaskFileKey = await fileKeysService.extractBgMaskAndUpload(fileKey);
    const imageFileKeyItem = {
      original: fileKey,
      withoutBg: fileKey,
      mask: bgMaskFileKey,
    } as HeroImageFileKeys;

    await blendService.addOrUpdateImageFileKeys(blend, imageFileKeyItem);
    return res.send(imageFileKeyItem);
  }

  return res.send(imageFileKeyItem);
};
