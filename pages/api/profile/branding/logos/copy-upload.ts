import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { BrandingLogoFromUploadsSource } from "server/repositories/branding";
import BrandingService from "server/service/branding";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureAuth(copyFromUploads, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const COPY_UPLOAD_SCHEMA = Joi.object({
  source: Joi.string()
    .required()
    .valid(...Object.values(BrandingLogoFromUploadsSource)),
  fileKey: Joi.string().required(),
});

async function copyFromUploads(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const validatedBody = validate(
    req.body as object,
    requestComponentToValidate.body,
    COPY_UPLOAD_SCHEMA
  );
  const { source, fileKey } = validatedBody as {
    source: BrandingLogoFromUploadsSource;
    fileKey: string;
  };

  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  res
    .status(201)
    .send(await brandingService.copyLogoFromUploads(req.uid, source, fileKey));
}
