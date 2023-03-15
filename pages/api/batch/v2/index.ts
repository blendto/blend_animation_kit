import { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BatchV2Service } from "server/service/batch-v2";
import { MethodNotAllowedError } from "server/base/errors";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(createBatch, req, res);
      case "GET":
        return ensureAuth(getUserBatches, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const createBatch = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const batchService = diContainer.get<BatchV2Service>(TYPES.BatchV2Service);
  const newBatch = await batchService.createBatch(req.uid);
  res.status(201).send(newBatch);
};

async function getUserBatches(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const batchService = diContainer.get<BatchV2Service>(TYPES.BatchService);
  const {
    query: { pageKey },
  } = req;
  const batches = await batchService.getUserBatches(req.uid, pageKey as string);
  res.send(batches);
}
