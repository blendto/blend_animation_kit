import { ServerError, UserError } from "../../server/base/errors";
import { nanoid } from "nanoid";
import DynamoDB from "../../server/external/dynamodb";
import { DateTime } from "luxon";

export default async (req, res) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await initCollab(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const initCollab = async (req, res) => {
  let collabRequestId;

  do {
    collabRequestId = nanoid(8);
    try {
      const item = await DynamoDB.getItem({
        TableName: process.env.BLEND_DYNAMODB_TABLE,
        Key: {
          id: collabRequestId,
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

  const collab = {
    id: collabRequestId,
    status: "INITIALIZED",
    statusUpdates: [
      {
        status: "INITIALIZED",
        on: Date.now(),
      },
    ],
    expireAt: DateTime.local().plus({ days: 1 }).startOf("second").toSeconds(),
  };

  try {
    await DynamoDB.putItem({
      TableName: process.env.BLEND_DYNAMODB_TABLE,
      Item: collab,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }

  res.send(collab);
};
