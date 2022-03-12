import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BatchService } from "server/service/batch";
import { BatchOperation } from "server/base/models/batchOperations";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(applyOperation, req, res);
      default:
        res.status(405).end();
    }
  }
);

const applyOperation = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
    body: { operation },
  } = req;
  const batchService = diContainer.get<BatchService>(TYPES.BatchService);
  await batchService.applyOperation(
    id as string,
    req.uid,
    operation as BatchOperation
  );
  const updatedBatch = await batchService.getBatch(id as string, req.uid, true);
  res.send(updatedBatch);
};
