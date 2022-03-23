import { NextApiResponse } from "next";
import { BatchService } from "server/service/batch";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getBatch, req, res);
      case "DELETE":
        return ensureAuth(deleteBatch, req, res);
      default:
        res.status(405).end();
    }
  }
);

const getBatch = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const {
    query: { id },
  } = req;

  const service = diContainer.get<BatchService>(TYPES.BatchService);
  const batch = await service.getBatch(id as string, req.uid, true);
  if (!batch) {
    return res.status(404).send("No such batch for user");
  }
  return res.status(200).json(batch);
};

const deleteBatch = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    uid,
    query: { id },
  } = req;
  const batchService = diContainer.get<BatchService>(TYPES.BatchService);
  await batchService.deleteBatch(id as string, uid);
  res.status(200).end();
};
