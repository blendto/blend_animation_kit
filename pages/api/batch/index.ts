import { NextApiResponse } from "next";
import { nanoid } from "nanoid";
import { Batch, BatchState } from "server/base/models/batch";
import DynamoDB from "server/external/dynamodb";
import ConfigProvider from "server/base/ConfigProvider";
import { DEFAULT_BATCH_OPERATION } from "server/base/models/batchOperations";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return createBatch(req, res, DynamoDB._());
      default:
        res.status(405).end();
    }
  }
);

const createBatch = async (
  req: NextApiRequestExtended,
  res: NextApiResponse,
  dataStore: DynamoDB
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
    outputs: {},
  } as Batch;
  await dataStore.putItem({
    TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
    Item: newBatch,
  });

  res.status(200).json(newBatch);
};
