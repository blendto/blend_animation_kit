import { diContainer } from "inversify.config";
import { MethodNotAllowedError } from "server/base/errors";
import { NextApiResponse } from "next";
import {
  ensureServiceAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import SubscriptionService from "server/service/subscription";
import { TYPES } from "server/types";
import { Entitlement } from "server/base/models/revenue-cat";
import Joi from "joi";
import { BlendMicroServices } from "server/internal/inter-service-auth";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "GET":
        return await ensureServiceAuth(
          BlendMicroServices.CataloguesService,
          checkEntitlement,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const ENTITLEMENTS_QUERY_SCHEMA = Joi.object({
  userId: Joi.string().required(),
  entitlement: Joi.string().valid(...Object.values(Entitlement)),
});

async function checkEntitlement(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  validate(
    req.query as object,
    requestComponentToValidate.query,
    ENTITLEMENTS_QUERY_SCHEMA
  );
  const { userId, entitlement } = req.query as {
    userId: string;
    entitlement: Entitlement;
  };

  const subscriptionService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );
  const hasEntitlement = await subscriptionService.userHasEntitlement(
    userId,
    entitlement
  );

  res.send({ hasEntitlement });
}
