import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { UploadRequestCreationConfig } from "server/base/models/batch";
import { BatchService } from "server/service/batch";
import { handleServerExceptions } from "server/base/errors";
import { DynamoBasedServiceLocator, IServiceLocator } from "server/service";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const serviceLocator = DynamoBasedServiceLocator.instance;
  switch (method) {
    case "POST":
      await initUpload(req, res, serviceLocator);
      break;
    default:
      res.status(405).json({ code: 405, message: `${method} not supported` });
  }
};

const initUpload = async (
  req: NextApiRequest,
  res: NextApiResponse,
  serviceLocator: IServiceLocator
) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });
  const {
    query: { id },
    body,
  } = req;

  return await handleServerExceptions(res, async () => {
    const service = serviceLocator.find(BatchService);
    const uploadRequests = await service.initUpload(
      id as string,
      uid as string,
      body as UploadRequestCreationConfig
    );
    return res.status(200).json(uploadRequests);
  });
};
