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
import BrandingService, {
  validUpdateOperations,
  validUpdateOperationsOnPrimaryLogo,
  validUpdatePaths,
} from "server/service/branding";
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
        res.status(405).send({ message: "Method not allowed" });
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
  res.send(await brandingService.getOrCreate(req.uid));
}

const UPDATE_BODY_SCHEMA = Joi.object({
  changes: Joi.array()
    .items(
      Joi.object({
        path: Joi.string()
          .required()
          .valid(...Object.values(validUpdatePaths)),
        op: Joi.string()
          .when("path", {
            is: validUpdatePaths.primaryLogo,
            then: Joi.valid(
              ...Object.values(validUpdateOperationsOnPrimaryLogo)
            ),
            otherwise: Joi.valid(...Object.values(validUpdateOperations)),
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
