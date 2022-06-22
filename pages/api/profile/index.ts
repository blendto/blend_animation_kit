import Joi from "joi";
import type { NextApiResponse } from "next";
import { UserJSONUpdate, UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { UserUpdatePaths } from "server/repositories/user";
import { UpdateOperations } from "server/repositories";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "GET":
        await ensureAuth(getProfile, req, res);
        break;
      case "PATCH":
        await ensureAuth(updateProfile, req, res);
        break;
      default:
        res.status(400).json({ code: 400, message: "Invalid request" });
    }
  }
);

const getProfile = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const userService = diContainer.get<UserService>(TYPES.UserService);
  let profile = await userService.fetch(req.uid);
  if (profile) {
    return res.json(profile);
  }
  profile = await userService.populateUserFromFirebase(req.uid);
  return res.json(profile);
};

const UPDATE_BODY_SCHEMA = Joi.object({
  changes: Joi.array()
    .items(
      Joi.object({
        path: Joi.string()
          .required()
          .valid(...Object.values(UserUpdatePaths)),
        op: Joi.string()
          .required()
          .valid(...Object.values(UpdateOperations)),
        value: Joi.any().when("op", {
          not: "remove",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      })
    )
    .required()
    .min(1),
});

const updateProfile = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    UPDATE_BODY_SCHEMA
  );

  const userService = diContainer.get<UserService>(TYPES.UserService);
  res.send(
    await userService.update(
      req.uid,
      (req.body as { changes: UserJSONUpdate[] }).changes
    )
  );
};
