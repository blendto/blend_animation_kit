import { NextApiResponse } from "next";
import { UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import Joi from "joi";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(migrateOwnership, req, res);
      default:
        res.status(405).end();
    }
  }
);

interface BlendOwnerMigrationRequest {
  sourceUserAccessToken: string;
}

const REQUEST_SCHEMA = Joi.object({
  sourceUserAccessToken: Joi.string().optional(),
});

const migrateOwnership = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const userService = diContainer.get<UserService>(TYPES.UserService);
  const ownerMigrationRequest = validate(
    req.body as object,
    requestComponentToValidate.body,
    REQUEST_SCHEMA
  ) as BlendOwnerMigrationRequest;

  const { migratedBlends, migratedBatches } = await userService.migrateData(
    ownerMigrationRequest.sourceUserAccessToken,
    req.uid
  );
  return res.status(200).json({ migratedBlends, migratedBatches });
};
