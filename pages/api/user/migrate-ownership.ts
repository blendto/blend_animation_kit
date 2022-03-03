import { NextApiResponse } from "next";
import { UserService } from "server/service/user";
import firebase from "server/external/firebase";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  NextApiRequestExtended,
  ensureAuth,
  withReqHandler,
} from "server/helpers/request";

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

const migrateOwnership = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const userService = diContainer.get<UserService>(TYPES.UserService);
  const { body } = req;
  const ownerMigrationRequest = body as BlendOwnerMigrationRequest;

  const decodedIdToken = await firebase.verifyAndDecodeToken(
    ownerMigrationRequest.sourceUserAccessToken
  );
  const sourceUid = decodedIdToken.uid;
  const migratedBlends = await userService.migrateUserBlends(
    sourceUid,
    req.uid
  );
  return res.status(200).json({ migratedBlends: migratedBlends });
};
