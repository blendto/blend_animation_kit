import { nanoid } from "nanoid";
import { DateTime } from "luxon";
import { ConfigProvider } from "antd";
// eslint-disable-next-line import/no-unresolved
import DynamoDB from "../../server/external/dynamodb";

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
      // eslint-disable-next-line no-await-in-loop
      const item = await DynamoDB._().getItem({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        Key: {
          id: collabRequestId,
        },
      });
      if (!item) {
        break;
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Something went wrong!" });
      return;
    }
    // eslint-disable-next-line no-constant-condition
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
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      Item: collab,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }

  res.send(collab);
};
