/* eslint-disable import/no-unresolved */
import { MethodNotAllowedError, UserError } from "server/base/errors";
import {
  createSignedUploadUrl,
  GetSignedUrlOperation,
} from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { withReqHandler } from "server/helpers/request";
import { NextApiRequest, NextApiResponse } from "next";
import { BlendVersion } from "server/base/models/blend";
import { ALL_SUPPORTED_EXTENSIONS } from "server/helpers/constants";
import { extractCorrectedFileName } from "server/helpers/fileKeyUtils";

const MAX_FILE_SIZE = 20 * 1024 * 1024; //  20 MB

export default withReqHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        await uploadImage(req, res);
        break;
      default:
        throw new MethodNotAllowedError();
    }
  }
);

enum UploadFileMethod {
  PUT = "PUT",
  POST = "POST",
}

export interface UploadFileRequest {
  collabId?: string;
  blendId?: string;
  fileName: string;
  method?: UploadFileMethod;
}

const uploadImage = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    collabId,
    blendId,
    fileName,
    method = UploadFileMethod.POST,
  } = req.body as UploadFileRequest;

  if (!collabId && !blendId) {
    throw new UserError("No blendId found in the request");
  }

  const id = blendId ?? collabId;

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  // Need consistent read coz blend might have just been created and not propagated yet
  const blend = await blendService.getBlend(id, true);

  if (!blend) {
    throw new UserError("No such blend exists");
  }
  const fileNameCorrected = extractCorrectedFileName(fileName);

  const urlDetails = await createSignedUploadUrl(
    fileNameCorrected,
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    ALL_SUPPORTED_EXTENSIONS,
    {
      keyPrefix: id + "/",
      maxSize: MAX_FILE_SIZE,
      operation:
        method === UploadFileMethod.PUT
          ? GetSignedUrlOperation.putObject
          : GetSignedUrlOperation.postObject,
    }
  );
  res.send(urlDetails);
};
