import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import AppleService from "server/external/apple";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { UpdateOperations } from "server/repositories";
import { UserUpdatePaths } from "server/repositories/user";
import { UserService } from "server/service/user";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "POST":
        await ensureAuth(storeAppleOfflineToken, req, res);
        break;
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const STORE_TOKEN_BODY_SCHEMA = Joi.object({
  authCode: Joi.string().required(),
});

const storeAppleOfflineToken = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const body = req.body as {
    authCode: string;
  };
  validate(body, requestComponentToValidate.body, STORE_TOKEN_BODY_SCHEMA);

  const userService = diContainer.get<UserService>(TYPES.UserService);
  const appleService = diContainer.get<AppleService>(TYPES.AppleService);

  const offlineToken = await appleService.getOfflineToken(body.authCode);
  await userService.update(req.uid, [
    {
      path: UserUpdatePaths.appleOfflineToken,
      op: UpdateOperations.add,
      value: offlineToken,
    },
  ]);
  res.end();
};
