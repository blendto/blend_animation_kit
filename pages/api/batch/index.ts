import { NextApiRequest, NextApiResponse } from "next";
import { nanoid } from "nanoid";
import { Batch, BatchState } from "server/base/models/batch";
import DynamoDB from "server/external/dynamodb";
import firebase from "server/external/firebase";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  switch (method) {
    case "POST":
      await createBatch(req, res, DynamoDB._());
      break;
    default:
      res.status(405).json({ code: 405, message: `${method} not supported` });
  }
};

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
    TableName: process.env.BATCH_DYNAMODB_TABLE,
    Item: newBatch,
  });

  res.status(200).json(newBatch);
};
