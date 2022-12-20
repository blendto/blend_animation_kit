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
      case "PATCH":
        return await ensureAuth(updateBranding, req, res);
      default:
        res.status(405).send({ message: "Method not allowed" });
    }
  }
);

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
