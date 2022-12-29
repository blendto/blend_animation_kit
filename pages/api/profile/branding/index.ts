import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
  requestComponentToValidate,
  validate,
} from "server/helpers/request";
import { UpdateOperations } from "server/repositories";
import {
  BrandingUpdateOperationsOnPrimaryLogo,
  BrandingUpdatePaths,
} from "server/repositories/branding";
import BrandingService from "server/service/branding";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "GET":
        return await ensureAuth(getBranding, req, res);
      case "PATCH":
        return await ensureAuth(updateBranding, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

async function getBranding(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const branding = await brandingService.get(req.uid);
  if (!branding) throw new UserError("User doesn't have a branding profile!");
  return res.send(branding);
}

const UPDATE_BODY_SCHEMA = Joi.object({
  changes: Joi.array()
    .items(
      Joi.object({
        path: Joi.string()
          .required()
          .valid(...Object.values(BrandingUpdatePaths)),
        op: Joi.string()
          .when("path", {
            is: BrandingUpdatePaths.primaryLogo,
            then: Joi.valid(
              ...Object.values(BrandingUpdateOperationsOnPrimaryLogo)
            ),
            otherwise: Joi.valid(...Object.values(UpdateOperations)),
          })
          .required(),
        value: Joi.any().when("op", {
          not: "remove",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      })
    )
    .required()
    .min(1),
});

async function updateBranding(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    UPDATE_BODY_SCHEMA
  );

  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  /* eslint-disable-next-line
    @typescript-eslint/no-unsafe-argument,
    @typescript-eslint/no-unsafe-member-access
  */
  res.send(await brandingService.update(req.uid, req.body.changes));
}
