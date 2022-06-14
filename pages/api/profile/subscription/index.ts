import { diContainer } from "inversify.config";
import { MethodNotAllowedError } from "server/base/errors";
import { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import SubscriptionService from "server/service/subscription";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "GET":
        return await ensureAuth(getSubscription, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

async function getSubscription(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const subscriptionService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );
  res.send(await subscriptionService.getOrCreate(req.uid));
}
