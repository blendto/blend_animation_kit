import { NextApiResponse } from "next";
import { nanoid } from "nanoid";
import { Batch, BatchState } from "server/base/models/batch";
import DynamoDB from "server/external/dynamodb";
import ConfigProvider from "server/base/ConfigProvider";
import { DEFAULT_BATCH_OPERATION } from "server/base/models/batchOperations";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BatchService } from "server/service/batch";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(createBatch, req, res);
      case "GET":
        return ensureAuth(getUserBatches, req, res);
      default:
        res.status(405).end();
    }
  }
);

const createBatch = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const now = Date.now();
  const newBatch = {
    id: nanoid(10),
    status: BatchState.IDLE,
    createdBy: req.uid,
    createdAt: now,
    updatedAt: now,
    operations: [DEFAULT_BATCH_OPERATION],
    pendingUploads: {},
    previews: {},
    outputs: {},
  } as Batch;

  const dataStore = diContainer.get<DynamoDB>(TYPES.DynamoDB);
  await dataStore.putItem({
    TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
    Item: newBatch,
  });

  res.status(200).json(newBatch);
};

async function getUserBatches(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const batchService = diContainer.get<BatchService>(TYPES.BatchService);
  const {
    query: { pageKey },
  } = req;
  const batches = await batchService.getUserBatches(req.uid, pageKey as string);
  res.status(200).send(batches);
}
