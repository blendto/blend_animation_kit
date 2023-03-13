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
import { ImageFileKeys } from "server/base/models/heroImage";
import FileKeysService from "server/service/fileKeys";
import { RemoveBgService } from "server/internal/remove-bg-service";
import HeroImageService from "server/service/heroImage";

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
  const { uid } = req;

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
  const heroImageService = diContainer.get<HeroImageService>(
    TYPES.HeroImageService
  );

  const blend = await blendService.getBlend(id, null, true);

  const fileKeyItem = await removeBgService.applyMaskAndUpload(
    originalFileKey,
    maskFileKey
  );

  const isHeroImage =
    blend.heroImages?.original === originalFileKey ||
    blend.heroImages?.withoutBg === originalFileKey;
  await blendService.addOrUpdateImageFileKeys(blend, fileKeyItem, {
    isHeroImage,
  });

  const heroImageId = blend.heroImages?.heroImageId;
  if (isHeroImage && heroImageId) {
    await heroImageService.updateBgRemoved(heroImageId, id, uid, fileKeyItem);
  }

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
    } as ImageFileKeys;

    await blendService.addOrUpdateImageFileKeys(blend, imageFileKeyItem);
    return res.send(imageFileKeyItem);
  }

  return res.send(imageFileKeyItem);
};
