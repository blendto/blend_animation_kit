import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { BatchService } from "server/service/batch";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(exportBatch, req, res);
      default:
        res.status(405).end();
    }
  }
);

const exportBatch = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
  } = req;

  const batchService = diContainer.get<BatchService>(TYPES.BatchService);
  await batchService.exportBatch(id as string, req.uid);
  res.status(200).end();
};
