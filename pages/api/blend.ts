import { nanoid } from "nanoid";
import DynamoDB from "server/external/dynamodb";
import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  switch (method) {
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

export const addBlendToDB = async (id: string, userId?: string) => {
  const now = Date.now();
  let blend = {
    id: id,
    status: "INITIALIZED",
    statusUpdates: [
      {
        status: "INITIALIZED",
        on: now,
      },
    ],
    expireAt: DateTime.local().plus({ days: 1 }).startOf("second").toSeconds(),
    createdAt: now,
    createdOn: DateTime.utc().toISODate(),
    ...(userId !== null && { createdBy: userId }),
  };

  await DynamoDB.putItem({
    TableName: process.env.BLEND_DYNAMODB_TABLE,
    Item: blend,
  });
  return blend;
};
