import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import Firebase from "server/external/firebase";
import {
  AuthType,
  ensureServiceAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import SubscriptionService, {
  CreditAdditionReason,
  NativeCreditsEntity,
} from "server/service/subscription";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureServiceAuth(
          BlendMicroServices.Retool,
          registerCreditRewards,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  },
  AuthType.SERVICE
);

const REGISTER_BODY_SCHEMA = Joi.object({
  rewards: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().required(),
        count: Joi.number().required(),
        reason: Joi.string()
          .required()
          .valid(...Object.values(CreditAdditionReason)),
      })
    )
    .required()
    .min(1),
});

type Reward = {
  userId: string;
  count: number;
  reason: CreditAdditionReason;
  subscriptionAfterUpdate?: NativeCreditsEntity;
};

async function registerCreditRewards(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    REGISTER_BODY_SCHEMA
  );
  const body = req.body as {
    rewards: Reward[];
  };

  await diContainer
    .get<Firebase>(TYPES.Firebase)
    .getUserByIdsOrFail(body.rewards.map((b) => b.userId));

  const subscriptionService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );
  const afterUpdateList = await Promise.all(
    body.rewards.map((reward) =>
      subscriptionService.addCredits(reward.userId, reward.count, reward.reason)
    )
  );

  afterUpdateList.forEach((afterUpdate, index) => {
    body.rewards[index].subscriptionAfterUpdate = afterUpdate;
  });
  res.send(body);
}
