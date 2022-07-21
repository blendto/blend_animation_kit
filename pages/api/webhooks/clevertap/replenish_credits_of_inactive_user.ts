import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import Firebase from "server/external/firebase";
import {
  AuthType,
  ensureServiceAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import SubscriptionService, { RenewReason } from "server/service/subscription";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureServiceAuth(
          BlendMicroServices.CleverTap,
          replenishCreditsOfInactiveUser,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  },
  AuthType.SERVICE
);

async function replenishCreditsOfInactiveUser(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const subscriptionService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );
  const { userId } = req.body as {
    userId: string;
  };
  try {
    await diContainer.get<Firebase>(TYPES.Firebase).getUserById(userId);
  } catch (err) {
    // User id shouldn't be invalid. Always throw a 500.
    if (err instanceof UserError) {
      throw new Error(err.message);
    }
    throw err;
  }

  // Since this call should accompany clevertap token, let's trust that the user is indeed inactive.
  // Don't bother validating that.

  const subscriptionBeforeRenewal = await subscriptionService.getOrCreate(
    userId
  );
  const subscriptionAfterRenewal = await subscriptionService.renew(
    userId,
    RenewReason.ENTICE_INACTIVE_USER
  );
  res.send({ subscriptionBeforeRenewal, subscriptionAfterRenewal });
}
