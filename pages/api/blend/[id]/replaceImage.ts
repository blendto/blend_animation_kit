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
import { ImageFileKeys } from "server/base/models/heroImage";
import { listObjectsInFolder } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";

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

const queryBucketForFileKeyItem = async (
  blendId: string,
  fileKeyAlreadyInBucket: string,
  imageFileKeyItems: ImageFileKeys[]
): Promise<ImageFileKeys> => {
  const files = await listObjectsInFolder(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    blendId
  );
  const fileObject = files.find((file) => file.Key === fileKeyAlreadyInBucket);
  const fileEtag = fileObject.ETag;

  return imageFileKeyItems.find((fileKeys) =>
    files.find(
      (file) => file.ETag === fileEtag && fileKeys.original === file.Key
    )
  );
};

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

  const blend = await blendService.getBlend(id, { consistentRead: true });

  const imageFileKeyItem = fileKeysService.retrieveFileKeyItemFromBlend(
    blend,
    targetOriginalFileKey
  );

  if (!imageFileKeyItem) {
    /**
     * Assuming that this api is getting called again
     * even though filekeys are updated.
     * We query for the filekey used in the blend by querying the hash of replacement image
     */
    const queriedFileKeyItem = await queryBucketForFileKeyItem(
      blend.id,
      replacementOriginalFileKey,
      blend.imageFileKeys
    );
    if (!queriedFileKeyItem) {
      throw new Error("FileKeyItem not found in blend");
    }
    return res.send(queriedFileKeyItem);
  }

  if (!imageFileKeyItem.mask) {
    throw new UserError("FileKeyItem does not have mask");
  }

  const fileKeyItem = await removeBgService.applyMaskAndUpload(
    replacementOriginalFileKey,
    imageFileKeyItem.mask
  );

  const isHeroImage = blend.heroImages?.original === targetOriginalFileKey;
  await blendService.addOrUpdateImageFileKeys(blend, fileKeyItem, {
    isHeroImage,
    fileKeyLookUpKey: targetOriginalFileKey,
  });

  const heroImageId = blend.heroImages?.heroImageId;
  if (isHeroImage && heroImageId) {
    await heroImageService.updateBgRemoved(heroImageId, id, uid, fileKeyItem);
  }

  return res.send(fileKeyItem);
};
