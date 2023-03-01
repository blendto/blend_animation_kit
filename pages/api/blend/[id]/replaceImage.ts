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
import { RemoveBgService } from "server/internal/remove-bg-service";
import FileKeysService from "server/service/fileKeys";
import HeroImageService from "server/service/heroImage";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "POST":
        await ensureAuth(replaceImage, req, res);
        break;
      default:
        throw new MethodNotAllowedError();
    }
  }
);

export const ImageReplacementRequestSchema = Joi.object({
  targetOriginalFileKey: Joi.string().required(),
  replacementOriginalFileKey: Joi.string().required(),
});

const replaceImage = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const { uid } = req;

  const { error } = ImageReplacementRequestSchema.validate(req.body);

  if (error) {
    throw new UserError(error.message);
  }

  const { targetOriginalFileKey, replacementOriginalFileKey } = req.body as {
    targetOriginalFileKey: string;
    replacementOriginalFileKey: string;
  };

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const removeBgService = diContainer.get<RemoveBgService>(
    TYPES.RemoveBgService
  );
  const fileKeysService = diContainer.get<FileKeysService>(
    TYPES.FileKeysService
  );
  const heroImageService = diContainer.get<HeroImageService>(
    TYPES.HeroImageService
  );

  const blend = await blendService.getBlend(id, null, true);

  const imageFileKeyItem = fileKeysService.retrieveFileKeyItemFromBlend(
    blend,
    targetOriginalFileKey
  );

  const fileKeyItem = await removeBgService.applyMaskAndUpload(
    replacementOriginalFileKey,
    imageFileKeyItem.mask
  );

  const isHeroImage = blend.heroImages?.original === targetOriginalFileKey;
  await blendService.addOrUpdateImageFileKeys(blend, fileKeyItem, {
    isHeroImage,
    fileKeyLookUpKey: targetOriginalFileKey,
  });
  if (isHeroImage) {
    const { heroImageId } = blend.heroImages;
    await heroImageService.updateBgRemoved(heroImageId, id, uid, fileKeyItem);
  }

  return res.send(fileKeyItem);
};
