/* eslint-disable import/no-unresolved */
import { MethodNotAllowedError } from "server/base/errors";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { NextApiResponse } from "next";
import Joi from "joi";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        await ensureAuth(initImageUpload, req, res);
        break;
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const UPLOAD_BODY_SCHEMA = Joi.object({
  fileName: Joi.string().required(),
});

const initImageUpload = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const validatedBody = validate(
    req.body as object,
    requestComponentToValidate.body,
    UPLOAD_BODY_SCHEMA
  );
  const { fileName } = validatedBody as {
    fileName: string;
  };
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  res.send(await blendService.initImageUpload(id, req.uid, fileName));
};
