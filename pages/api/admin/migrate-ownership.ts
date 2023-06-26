import { NextApiResponse } from "next";
import { UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureServiceAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import Joi from "joi";
import { BlendMicroServices } from "server/internal/inter-service-auth";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureServiceAuth(
          BlendMicroServices.Retool,
          migrateOwnership,
          req,
          res
        );
      default:
        res.status(405).end();
    }
  }
);

const REQUEST_SCHEMA = Joi.object({
  sourceUserId: Joi.string().required(),
  targetUserId: Joi.string().required(),
});

const migrateOwnership = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const userService = diContainer.get<UserService>(TYPES.UserService);
  const { sourceUserId, targetUserId } = validate(
    req.body as object,
    requestComponentToValidate.body,
    REQUEST_SCHEMA
  ) as {
    sourceUserId: string;
    targetUserId: string;
  };
  const { migratedBlends, migratedBatches } = await userService.migrateData(
    sourceUserId,
    targetUserId
  );
  return res.status(200).json({ migratedBlends, migratedBatches });
};
