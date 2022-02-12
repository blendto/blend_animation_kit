import { nanoid } from "nanoid";
import DynamoDB from "server/external/dynamodb";
import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { handleServerExceptions } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import { HeroImageFileKeys } from "server/base/models/heroImage";

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
      res.status(404).json({ code: 404, message: "Invalid request" });
  }
};

const initBlend = async (req: NextApiRequest, res: NextApiResponse) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });
  try {
    const blend = await initBlendInternal(uid);
    return res.send(blend);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
    return;
  }
};

export const initBlendInternal = async (
  uid: string,
  options?: { batchId: string; heroFileName: string }
) => {
  let blendRequestId: string;
  do {
    blendRequestId = nanoid(8);
    const item = await DynamoDB._().getItem({
      TableName: process.env.BLEND_DYNAMODB_TABLE,
      Key: {
        id: blendRequestId,
      },
    });
    if (!item) {
      break;
    }
  } while (true);

  let fileKey = null;
  if (options?.heroFileName) {
    fileKey = `${blendRequestId}/${options.heroFileName}`;
  }

  return await addBlendToDB(blendRequestId, uid, {
    batchId: options?.batchId,
    heroImages: {
      original: fileKey,
    },
  });
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

  const encodedPageKey = new EncodedPageKey(pageKey);
  if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
    return res.status(400).json({ message: "pageKey should be a string" });
  }
  try {
    pageKeyObject = encodedPageKey.decode();
  } catch (e) {
    return res.status(400).json({ message: "Invalid pageKey format" });
  }

  let items = [];
  let nextPageKey = null;
  try {
    const data = await DynamoDB._().queryItems({
      TableName: process.env.BLEND_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "createdBy-updatedAt-idx",
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
        "id, filePath, imagePath, thumbnail, #output, createdAt, updatedAt, #status",
      FilterExpression: "#status = :generated or #status = :submitted",
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject,
      Limit: 15,
    });

    items = data.Items.map((item) => {
      return backfillBlendOutput(<Blend>item);
    });

    nextPageKey = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
    return;
  }

  res.send({ data: items, nextPageKey });
};

export const addBlendToDB = async (
  id: string,
  userId?: string,
  options?: { batchId: string; heroImages: HeroImageFileKeys }
) => {
  const currentTime = Date.now();
  const currentDate = DateTime.utc().toISODate();

  let blend: Blend = {
    id: id,
    batchId: options?.batchId,
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
    heroImages: options?.heroImages,
    ...(userId !== null && { createdBy: userId }),
  };

  await DynamoDB._().putItem({
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
