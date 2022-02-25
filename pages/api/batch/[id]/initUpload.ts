import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { UploadRequestCreationConfig } from "server/base/models/batch";
import BatchService from "server/service/batch";
import { handleServerExceptions } from "server/base/errors";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  switch (method) {
    case "POST":
      await initUpload(req, res);
      break;
    default:
      res.status(405).json({ code: 405, message: `${method} not supported` });
  }
};

const initUpload = async (req: NextApiRequest, res: NextApiResponse) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });
  const {
    query: { id },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    body,
  } = req;

  return handleServerExceptions(res, async () => {
    const service = diContainer.get<BatchService>(TYPES.BatchService);
    const uploadRequests = await service.initUpload(
      id as string,
      uid,
      body as UploadRequestCreationConfig
    );
    return res.status(200).json(uploadRequests);
  });
};
