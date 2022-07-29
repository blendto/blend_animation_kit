import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import ReferralService from "server/service/referral";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "GET":
        return await ensureAuth(getReferralSummary, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

async function getReferralSummary(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const referralService = diContainer.get<ReferralService>(
    TYPES.ReferralService
  );
  return res.send(await referralService.getSummary(req.uid));
}
