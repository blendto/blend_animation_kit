import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { UploadRequestCreationConfig } from "server/base/models/batch";
import { BatchService } from "server/service/batch";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import withErrorHandler from "request-handler";

export default withErrorHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return initUpload(req, res);
      default:
        res.status(405).end();
    }
  }
);

const initUpload = async (req: NextApiRequest, res: NextApiResponse) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });
  const {
    query: { id },
    body,
  } = req;

  const service = diContainer.get<BatchService>(TYPES.BatchService);
  const uploadRequests = await service.initUpload(
    id as string,
    uid as string,
    body as UploadRequestCreationConfig
  );
  return res.status(200).json(uploadRequests);
};
