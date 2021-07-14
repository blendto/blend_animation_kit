import { nanoid } from "nanoid";
import DynamoDB from "server/external/dynamodb";
import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { handleServerExceptions } from "server/base/errors";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  switch (method) {
    case "GET":
      await getAllBlends(req, res);
      break;
    case "POST":
      await initBlend(req, res);
      break;

    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const initBlend = async (req: NextApiRequest, res: NextApiResponse) => {
  let blendRequestId: string;

  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });

  do {
    blendRequestId = nanoid(8);
    try {
      const item = await DynamoDB.getItem({
        TableName: process.env.BLEND_DYNAMODB_TABLE,
        Key: {
          id: blendRequestId,
        },
      });
      if (!item) {
        break;
      }
      continue;
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Something went wrong!" });
      return;
    }
  } while (true);

  try {
    const blend = await addBlendToDB(blendRequestId, uid);
    return res.send(blend);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
    return;
  }
};

const getAllBlends = async (req: NextApiRequest, res: NextApiResponse) => {
  let uid: string;

  await handleServerExceptions(res, async () => {
    uid = await firebase.extractUserIdFromRequest({
      request: req,
    });
  });

  if (!uid) {
    // Exception would have been managed above
    return;
  }

  let items = [];
  let nextPageKey = null;
  try {
    const data = await DynamoDB.queryItems({
      TableName: process.env.BLEND_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "created-by-idx",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
        ":generated": "GENERATED",
        ":submitted": "SUBMITTED",
      },
      ProjectionExpression: "id, filePath, imagePath, #status",
      FilterExpression: "#status = :generated or #status = :submitted",
      ScanIndexForward: false,
    });
    items = data.Items;
    nextPageKey = data.LastEvaluatedKey;
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
    return;
  }

  res.send({ data: items, nextPageKey });
};

export const addBlendToDB = async (id: string, userId?: string) => {
  const currentTime = Date.now();
  const currentDate = DateTime.utc().toISODate();

  let blend = {
    id: id,
    status: "INITIALIZED",
    statusUpdates: [
      {
        status: "INITIALIZED",
        on: currentTime,
      },
    ],
    expireAt: DateTime.local().plus({ days: 1 }).startOf("second").toSeconds(),
    createdAt: currentTime,
    createdOn: currentDate,
    updatedAt: currentTime,
    updatedOn: currentDate,
    ...(userId !== null && { createdBy: userId }),
  };

  await DynamoDB.putItem({
    TableName: process.env.BLEND_DYNAMODB_TABLE,
    Item: blend,
  });
  return blend;
};
