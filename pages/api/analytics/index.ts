import type { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { NewAnalyticsService } from "server/service/newAnalytics";
import { SaveAnalyticsRequest } from "server/base/models/analytics";
import { MethodNotAllowedError } from "server/base/errors";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "PUT":
        await ensureAuth(saveAnalytics, req, res);
        break;
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const saveAnalytics = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { uid } = req;
  const analyticsRequest = req.body as SaveAnalyticsRequest;
  const service = diContainer.get<NewAnalyticsService>(TYPES.AnalyticsService);
  await service.logAnalytics(uid, analyticsRequest);
  return res.status(200).end();
};
