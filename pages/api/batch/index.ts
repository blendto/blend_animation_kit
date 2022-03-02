import { NextApiRequest, NextApiResponse } from "next";
import { nanoid } from "nanoid";
import { Batch, BatchState } from "server/base/models/batch";
import DynamoDB from "server/external/dynamodb";
import firebase from "server/external/firebase";
import ConfigProvider from "server/base/ConfigProvider";
import withErrorHandler from "request-handler";

export default withErrorHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
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
  req: NextApiRequest,
  res: NextApiResponse,
  dataStore: DynamoDB
) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });

  const now = Date.now();
  const newBatch = {
    id: nanoid(10),
    status: BatchState.IDLE,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
    pendingUploads: {},
  } as Batch;
  await dataStore.putItem({
    TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
    Item: newBatch,
  });

  res.status(200).json(newBatch);
};
