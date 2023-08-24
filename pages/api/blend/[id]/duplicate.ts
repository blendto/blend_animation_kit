import type { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { MethodNotAllowedError, ObjectNotFoundError } from "server/base/errors";
import { ImageFileKeys } from "server/base/models/heroImage";
import FileKeysService from "server/service/fileKeys";
import { Blend } from "server/base/models/blend";
import ConfigProvider from "server/base/ConfigProvider";
import { Recipe } from "server/base/models/recipe";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "POST":
        await ensureAuth(duplicateBlend, req, res);
        break;
      default:
        throw new MethodNotAllowedError();
    }
  }
);

function copyAndUpdateReferences(
  existingRecipe: Recipe,
  newBlend: Blend
): Blend {
  const newBlendBody = structuredClone({ ...existingRecipe, ...newBlend });

  newBlendBody.images = existingRecipe.images?.map((image) => ({
    ...image,
    uri: image.uri.replace(new RegExp(`^${existingRecipe.id}`), newBlend.id),
  }));
  if (existingRecipe.heroImages?.original) {
    newBlendBody.heroImages = replaceFileKeysWithNewBlendId(
      existingRecipe.heroImages,
      existingRecipe.id,
      newBlend.id
    );
  }
  newBlendBody.imageFileKeys = newBlendBody.imageFileKeys?.map((fileKeys) =>
    replaceFileKeysWithNewBlendId(fileKeys, existingRecipe.id, newBlend.id)
  );
  return newBlendBody;
}

const duplicateBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const { uid } = req;

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const fileKeysService = diContainer.get<FileKeysService>(
    TYPES.FileKeysService
  );

  const blend = await blendService.getBlend(id, {
    userId: req.uid,
    consistentRead: true,
  });

  if (!blend) {
    throw new ObjectNotFoundError("Blend not found");
  }

  const newBlend = await blendService.initBlend(uid, {
    sourceMetadata: blend.metadata.source,
  });

  await fileKeysService.copyFolderContents({
    srcPrefix: id,
    dstPrefix: newBlend.id,
    dstBucket: ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    srcBucket: ConfigProvider.BLEND_INGREDIENTS_BUCKET,
  });

  const newRecipe = copyAndUpdateReferences(blend, newBlend);
  await blendService.putBlendBody(newRecipe);

  res.send(newRecipe);
};

const replaceFileKeysWithNewBlendId = (
  fileKeys: ImageFileKeys,
  oldBlendId: string,
  newBlendId: string
): ImageFileKeys => {
  const fileKeyReplaceRegex = new RegExp(`^${oldBlendId}`);

  return {
    ...fileKeys,
    original: fileKeys?.original?.replace(fileKeyReplaceRegex, newBlendId),
    withoutBg: fileKeys?.withoutBg?.replace(fileKeyReplaceRegex, newBlendId),
    mask: fileKeys?.mask?.replace(fileKeyReplaceRegex, newBlendId),
  };
};
