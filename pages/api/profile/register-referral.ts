import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { RewardType } from "server/repositories/referral";
import ReferralService, {
  REFEREE_CREDITS_REWARD_QUANTITY,
  REFERRAL_USER_ERROR,
} from "server/service/referral";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureAuth(register, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const REGISTER_BODY_SCHEMA = Joi.object({
  referralId: Joi.string().required(),
  deviceId: Joi.string().required(),
  dryRun: Joi.bool(),
});

async function register(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const body = req.body as {
    referralId: string;
    deviceId: string;
    dryRun: boolean;
  };
  validate(body, requestComponentToValidate.body, REGISTER_BODY_SCHEMA);

  const referralService = diContainer.get<ReferralService>(
    TYPES.ReferralService
  );
  await referralService.ensureDeviceIdIsOriginal(body.deviceId);
  await referralService.ensureRefereeIsNew(req.uid);
  const referrer = await referralService.getReferrerOrFail(body.referralId);
  if (req.uid === referrer.id) {
    throw new UserError(
      `User found to be trying to self refer! Id: ${referrer.id}`,
      REFERRAL_USER_ERROR.SELF_REFERRAL
    );
  }
  if (body.dryRun) {
    return res.send({
      referrerId: referrer.id,
      reward: {
        type: RewardType.CREDITS,
        quantity: REFEREE_CREDITS_REWARD_QUANTITY,
      },
    });
  }
  res.send(await referralService.register(req.uid, referrer.id, body.deviceId));
}
