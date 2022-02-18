import { NextApiRequest, NextApiResponse } from "next";
import { UserService } from "server/service/user";
import firebase from "server/external/firebase";
import { handleServerExceptions } from "server/base/errors";
import { DynamoBasedServiceLocator, IServiceLocator } from "server/service";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const serviceLocator = DynamoBasedServiceLocator.instance;
  try {
    switch (method) {
      case "POST":
        await migrateOwnership(req, res, serviceLocator);
        break;

      default:
        res.status(403).json({ message: "Unsupported method" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
};

interface BlendOwnerMigrationRequest {
  sourceUserAccessToken: string;
}

const migrateOwnership = async (
  req: NextApiRequest,
  res: NextApiResponse,
  serviceLocator: IServiceLocator
) => {
  const userService = serviceLocator.find(UserService);
  const targetUid = await firebase.extractUserIdFromRequest({
    request: req,
  });
  const { body } = req;
  const ownerMigrationRequest = body as BlendOwnerMigrationRequest;

  return await handleServerExceptions(res, async () => {
    const decodedIdToken = await firebase.verifyAndDecodeToken(
      ownerMigrationRequest.sourceUserAccessToken
    );
    const sourceUid = decodedIdToken.uid;
    const migratedBlends = await userService.migrateUserBlends(
      sourceUid,
      targetUid
    );
    return res.status(200).json({ migratedBlends: migratedBlends });
  });
};
