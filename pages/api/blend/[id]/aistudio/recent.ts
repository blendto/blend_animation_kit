import type { NextApiRequest, NextApiResponse } from "next";

import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import {
  MethodNotAllowedError,
  ObjectNotFoundError,
  UserError,
} from "server/base/errors";
import { diContainer } from "inversify.config";
import { AIStudioService } from "server/service/aistudio";
import { TYPES } from "server/types";
import { GeneratedImageMetadata } from "server/base/models/aistudio";
import { BlendService } from "server/service/blend";
import formidable from "formidable";
import { uploadObject } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import { bufferToStream } from "server/helpers/bufferUtils";
import fs from "fs/promises";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(addToRecents, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const parseForm = async (
  req: NextApiRequest
): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  const form = formidable({});
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
};

const addToRecents = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { fields, files } = await parseForm(req);

  const file = <formidable.File>files.thumbnail[0];
  if (!file) {
    throw new UserError("No File in request body");
  }
  const generationMetadata = JSON.parse(
    <string>fields.generationMetadata
  ) as GeneratedImageMetadata;

  const generatedImageId = fields.generatedImageId[0];

  if (!generationMetadata || !generatedImageId) {
    throw new UserError("Invalid request body");
  }

  const { uid } = req;

  const { id: blendId } = req.query as { id: string };

  const aiStudioService = diContainer.get<AIStudioService>(
    TYPES.AIStudioService
  );

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  const blend = await blendService.getBlend(blendId, {
    userId: uid,
  });

  if (!blend) {
    throw new ObjectNotFoundError("Blend not found");
  }

  const thumbnailFileKey = `${blendId}/${file.originalFilename}`;
  const fileBuffer = await fs.readFile(file.filepath);

  await uploadObject(
    ConfigProvider.AI_STUDIO_RECENTS_BUCKET,
    thumbnailFileKey,
    bufferToStream(fileBuffer)
  );

  const out = await aiStudioService.addRecent(
    uid,
    blendId,
    generatedImageId,
    generationMetadata,
    thumbnailFileKey
  );
  res.send(out);
};
