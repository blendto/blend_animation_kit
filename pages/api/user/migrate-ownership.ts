import { NextApiResponse } from "next";
import { UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import Firebase from "server/external/firebase";

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
  const ownerMigrationRequest = req.body as BlendOwnerMigrationRequest;
  const firebaseService = diContainer.get<Firebase>(TYPES.Firebase);
  const decodedIdToken = await firebaseService.verifyAndDecodeToken(
    ownerMigrationRequest.sourceUserAccessToken
  );
  const sourceUid = decodedIdToken.uid;
  const blendsPromise = userService.migrateUserBlends(sourceUid, req.uid);
  const batchesPromise = userService.migrateUserBatches(sourceUid, req.uid);

  const [migratedBlends, migratedBatches] = await Promise.all([
    blendsPromise,
    batchesPromise,
  ]);
  return res.status(200).json({ migratedBlends, migratedBatches });
};
