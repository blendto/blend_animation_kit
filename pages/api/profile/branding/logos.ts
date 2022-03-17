import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
  requestComponentToValidate,
  validate,
} from "server/helpers/request";
import BrandingService from "server/service/branding";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureAuth(initLogoUpload, req, res);
      case "DELETE":
        return await ensureAuth(delLogo, req, res);
      default:
        res.status(405).send({ message: "Method not allowed" });
    }
  }
);

const INIT_BODY_SCHEMA = Joi.object({
  fileName: Joi.string().required(),
});

async function initLogoUpload(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    INIT_BODY_SCHEMA
  );

  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  res
    .status(201)
    /* eslint-disable-next-line
      @typescript-eslint/no-unsafe-argument,
      @typescript-eslint/no-unsafe-member-access
    */
    .send(await brandingService.initLogoUpload(req.uid, req.body.fileName));
}

const DEL_QUERY_SCHEMA = Joi.object({
  fileKey: Joi.string().required(),
});

async function delLogo(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  validate(
    req.query as object,
    requestComponentToValidate.query,
    DEL_QUERY_SCHEMA
  );

  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  /* eslint-disable-next-line
    @typescript-eslint/no-unsafe-argument,
    @typescript-eslint/no-unsafe-member-access
  */
  res.send(await brandingService.delLogo(req.uid, req.query.fileKey as string));
}
