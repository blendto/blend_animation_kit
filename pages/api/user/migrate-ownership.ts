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
import logger from "server/base/Logger";
import CatalogueServiceApi from "server/internal/catalogue-service-api";

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
  const catalogueServiceApi = diContainer.get<CatalogueServiceApi>(
    TYPES.CatalogueServiceApi
  );
  const ownerMigrationRequest = req.body as BlendOwnerMigrationRequest;
  const firebaseService = diContainer.get<Firebase>(TYPES.Firebase);
  const decodedIdToken = await firebaseService.verifyAndDecodeToken(
    ownerMigrationRequest.sourceUserAccessToken
  );
  const sourceUid = decodedIdToken.uid;

  if (sourceUid === req.uid) {
    logger.warn({
      op: "SAME_USER_MIGRATION_ATTEMPT",
      message: "Attempted to migrate ownership to the same user",
      sourceUid,
      targetUid: req.uid,
    });
    return res.status(200).json({ migratedBlends: [], migratedBatches: [] });
  }

  const brandingPromise = userService.migrateBranding(sourceUid, req.uid);
  const blendsPromise = userService.migrateUserBlends(sourceUid, req.uid);
  const batchesPromise = userService.migrateUserBatches(sourceUid, req.uid);
  const cataloguesPromise = catalogueServiceApi.migrate(sourceUid, req.uid);

  const [
    brandingPromiseRes,
    migratedBlends,
    migratedBatches,
    cataloguesPromiseRes,
  ] = await Promise.all([
    brandingPromise,
    blendsPromise,
    batchesPromise,
    cataloguesPromise,
  ]);
  return res.status(200).json({ migratedBlends, migratedBatches });
};
