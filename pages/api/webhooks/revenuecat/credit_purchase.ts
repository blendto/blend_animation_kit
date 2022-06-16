import { diContainer } from "inversify.config";
import { nanoid } from "nanoid";
import { NextApiResponse } from "next";
import ConfigProvider from "server/base/ConfigProvider";
import { MethodNotAllowedError, UserError } from "server/base/errors";
import DynamoDB from "server/external/dynamodb";
import Firebase, { FirebaseErrCode } from "server/external/firebase";
import {
  AuthType,
  ensureServiceAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import SubscriptionService from "server/service/subscription";
import { TYPES } from "server/types";
import { WebhookSources } from "..";

enum ErrorCode {
  INVALID_PRODUCT_ID = "INVALID_PRODUCT_ID",
  INVALID_USER_ID = "INVALID_USER_ID",
}

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureServiceAuth(
          BlendMicroServices.RevenueCatWebHook,
          registerCreditPurchase,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  },
  AuthType.SERVICE
);

const registerCreditPurchase = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const reqBody = req.body as Record<string, unknown>;
  const { event } = reqBody as {
    event: {
      type: string;
      app_user_id: string;
      product_id: string;
    };
  };

  if (event.type !== "NON_RENEWING_PURCHASE") {
    return res.send({});
  }

  const creditsToAdd =
    ConfigProvider.REVENUECAT_CREDIT_OFFERINGS[event.product_id];
  if (!creditsToAdd) {
    await logFailure(reqBody, ErrorCode.INVALID_PRODUCT_ID);
    throw new Error(
      `Received invalid product id: ${event.product_id}. Is there a new id?. Update the config!`
    );
  }

  const firebaseService = diContainer.get<Firebase>(TYPES.Firebase);
  try {
    await firebaseService.getUserById(event.app_user_id);
  } catch (err) {
    if (
      err instanceof UserError &&
      err.code === FirebaseErrCode.USER_NOT_FOUND
    ) {
      await logFailure(reqBody, ErrorCode.INVALID_USER_ID);
      throw new Error(
        `Received invalid user id: ${event.app_user_id}. Anonymous user?`
      );
    } else {
      await logFailure(reqBody);
      throw err;
    }
  }

  const subscriptionService = diContainer.get<SubscriptionService>(
    TYPES.SubscriptionService
  );
  try {
    res.send(
      await subscriptionService.addCredits(event.app_user_id, creditsToAdd)
    );
  } catch (err) {
    await logFailure(reqBody);
    throw err;
  }
};

async function logFailure(
  reqBody: Record<string, unknown>,
  errCode?: ErrorCode
) {
  const id = Date.now().toString() + "-" + nanoid(8);
  await DynamoDB._().putItem({
    TableName: ConfigProvider.FAILED_WEBHOOK_CALLS_TABLE,
    Item: {
      id,
      source: WebhookSources.REVENUE_CAT,
      errCode,
      reqBody,
    },
  });
}
