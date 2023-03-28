import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import {
  MethodNotAllowedError,
  ObjectNotFoundError,
  UserErrorCode,
} from "server/base/errors";
import {
  NextApiRequestExtended,
  withReqHandler,
  requestComponentToValidate,
  validate,
  ensureServiceAuth,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import BrandingService from "server/service/branding";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "GET":
        return await ensureServiceAuth(
          BlendMicroServices.CataloguesService,
          getBranding,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const BRANDINGS_QUERY_SCHEMA = Joi.object({
  userId: Joi.string().required(),
});

async function getBranding(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  validate(
    req.query as object,
    requestComponentToValidate.query,
    BRANDINGS_QUERY_SCHEMA
  );
  const { userId } = req.query as {
    userId: string;
  };
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const branding = await brandingService.get(userId);
  if (!branding) {
    throw new ObjectNotFoundError(UserErrorCode.BRANDING_PROFILE_NOT_FOUND);
  }

  return res.send(branding);
}
