import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
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
        return await ensureAuth(getLedger, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

async function getLedger(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const query = req.query as {
    nextPageToken?: string;
  };
  const subscriptionService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );
  res.send(await subscriptionService.getLedger(req.uid, query.nextPageToken));
}
