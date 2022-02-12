import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { UploadRequestCreationConfig } from "server/base/models/batch";
import { BatchService } from "server/service/batch";
import { handleServerExceptions } from "server/base/errors";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const service = new BatchService();
  switch (method) {
    case "POST":
      await initUpload(req, res, service);
      break;
    default:
      res.status(405).json({ code: 405, message: `${method} not supported` });
  }
};

const initUpload = async (
  req: NextApiRequest,
  res: NextApiResponse,
  service: BatchService
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
    const uploadRequests = await service.initUpload(
      id as string,
      uid as string,
      body as UploadRequestCreationConfig
    );
    return res.status(200).json(uploadRequests);
  });
};
