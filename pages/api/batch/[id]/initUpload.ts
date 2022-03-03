import { NextApiResponse } from "next";
import { UploadRequestCreationConfig } from "server/base/models/batch";
import { BatchService } from "server/service/batch";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return initUpload(req, res);
      default:
        res.status(405).end();
    }
  }
);

const initUpload = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
    body,
  } = req;

  const service = diContainer.get<BatchService>(TYPES.BatchService);
  const uploadRequests = await service.initUpload(
    id as string,
    req.uid as string,
    body as UploadRequestCreationConfig
  );
  return res.status(200).json(uploadRequests);
};
