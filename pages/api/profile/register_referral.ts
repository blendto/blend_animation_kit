import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { REWARD_TYPE } from "server/repositories/referral";
import ReferralService, {
  REFEREE_CREDITS_REWARD_QUANTITY,
} from "server/service/referral";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureAuth(registerReferral, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const REGISTER_BODY_SCHEMA = Joi.object({
  referralId: Joi.string().required(),
});
const REGISTER_QUERY_SCHEMA = Joi.object({
  dryRun: Joi.bool(),
});

async function registerReferral(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const body = req.body as {
    referralId: string;
  };
  validate(body, requestComponentToValidate.body, REGISTER_BODY_SCHEMA);
  const query = req.query as {
    dryRun: string;
  };
  validate(query, requestComponentToValidate.query, REGISTER_QUERY_SCHEMA);
  const referralService = diContainer.get<ReferralService>(
    TYPES.ReferralService
  );

  const referrer = await referralService.getReferrerOrFail(body.referralId);
  if (query.dryRun?.toLowerCase() === "true") {
    return res.send({
      reward: {
        type: REWARD_TYPE.CREDITS,
        quantity: REFEREE_CREDITS_REWARD_QUANTITY,
      },
    });
  }
  res.send(await referralService.registerReferral(req.uid, referrer.id));
}
