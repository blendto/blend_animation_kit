import { nanoid } from "nanoid";
import DynamoDB from "server/external/dynamodb";
import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { handleServerExceptions } from "server/base/errors";
import Base64 from "server/helpers/base64";
import { Blend } from "server/base/models/blend";

// Resolution to use when output object is not populated
// When aspect ratio used to be fixed, these were the constant ones.
const FALLBACK_OUTPUT_RESOLUTION = { width: 720, height: 1280 };
const FALLBACK_OUTPUT_THUMBNAIL_RESOLUTION = { width: 628, height: 1200 };

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

  const {
    query: { pageKey },
  } = req;

  await handleServerExceptions(res, async () => {
    uid = await firebase.extractUserIdFromRequest({
      request: req,
    });
  });

  if (!uid) {
    // Exception would have been managed above
    return;
  }

  let pageKeyObject = null;

  if (pageKey != null) {
    if (typeof pageKey != "string") {
      return res.status(400).json({ message: "pageKey should be a string" });
    }

    try {
      pageKeyObject = JSON.parse(Base64.decode(pageKey));
    } catch (e) {
      return res.status(400).json({ message: "Invalid pageKey format" });
    }
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
        "#output": "output",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
        ":generated": "GENERATED",
        ":submitted": "SUBMITTED",
      },
      ProjectionExpression:
        "id, filePath, imagePath, #output, createdAt, updatedAt, #status",
      FilterExpression: "#status = :generated or #status = :submitted",
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject,
      Limit: 15,
    });

    items = data.Items.map((item) => {
      return backfillBlendOutput(<Blend>item);
    });

    nextPageKey = data.LastEvaluatedKey
      ? Base64.encode(JSON.stringify(data.LastEvaluatedKey))
      : null;
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

  let blend: Blend = {
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

export const backfillBlendOutput = (item: Blend) => {
  let { filePath, imagePath, thumbnail, output, status } = item;

  if (!output && status == "GENERATED") {
    output = {
      video: {
        path: filePath,
        resolution: FALLBACK_OUTPUT_RESOLUTION,
      },
      image: {
        path: imagePath,
        resolution: FALLBACK_OUTPUT_RESOLUTION,
      },
      thumbnail: {
        path: thumbnail,
        resolution: FALLBACK_OUTPUT_THUMBNAIL_RESOLUTION,
      },
    };
  }

  return {
    ...item,
    filePath: output?.video.path ?? null,
    imagePath: output?.image.path ?? null,
    thumbnail: output?.thumbnail.path ?? null,
    output: output ?? null,
  };
};
