import DynamoDB from "server/external/dynamodb";
import SQS from "server/external/sqs";
import { addBlendToDB } from "../blend";
import firebase from "server/external/firebase";
import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import { Recipe } from "server/base/models/recipe";
import { handleServerExceptions } from "server/base/errors";
import { Blend } from "server/base/models/blend";

const MIN_SUPPORTED_ENCODER_VERSION = 1.0;
const CURRENT_ENCODER_VERSION = 2.2;

// Resolution to use when output object is not populated
// When aspect ratio used to be fixed, these were the constant ones.
const FALLBACK_OUTPUT_RESOLUTION = { width: 720, height: 1280 };
const FALLBACK_OUTPUT_THUMBNAIL_RESOLUTION = { width: 628, height: 1200 };

export const _getBlend = async (id: string): Promise<Blend> => {
  const blend = await DynamoDB.getItem({
    TableName: process.env.BLEND_DYNAMODB_TABLE,
    Key: {
      id,
    },
  });
  let { filePath, imagePath, thumbnail, output, status } = blend;

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
    ...blend,
    filePath: output?.video.path ?? null,
    imagePath: output?.image.path ?? null,
    thumbnail: output?.thumbnail.path ?? null,
    output: output ?? null,
  };
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  switch (method) {
    case "GET":
      await getBlend(req, res);
      break;
    case "POST":
      await submitBlend(req, res);
      break;
    case "DELETE":
      await deleteBlend(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const trimInteractions = (recipe: Recipe) => {
  const { interactions } = recipe;

  const interactionsToRender = interactions
    .filter((interaction) => !!interaction.userInteraction)
    .map(({ assetType, metadata, userInteraction }) => ({
      assetType,
      metadata,
      userInteraction,
    }));

  return interactionsToRender;
};

const deleteBlend = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id },
  } = req;

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

  const blend = await _getBlend(id as string);

  if (!blend) {
    return res.status(404).send({ message: "Blend not found!" });
  }

  if (blend.createdBy != uid) {
    return res.status(403).send({ message: "Forbidden" });
  }

  await DynamoDB.deleteItem({
    TableName: process.env.BLEND_DYNAMODB_TABLE,
    Key: {
      id: id,
    },
  });

  res.send({ status: "Success" });
};

const getBlend = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id, format, target },
  } = req;

  const blend = await _getBlend(id as string);

  if (!blend) {
    res.status(404).send({ message: "Blend not found!" });
    return;
  }

  const {
    id: blendId,
    status,
    images,
    externalImages,
    gifsOrStickers,
    texts,
    buttons,
    links,
    interactions,
    metadata,
    output,
    filePath,
    imagePath,
  } = blend;

  if ((format as string)?.toUpperCase() == "RECIPE") {
    const recipe = {
      id,
      images,
      externalImages,
      gifsOrStickers,
      texts,
      buttons,
      links,
      interactions,
      metadata,
    };

    if (metadata.source.version >= 2.0 && target == null) {
      return res.status(400).json({
        message:
          "This recipe cannot be remixed on this app version. Please upgrade the app.",
      });
    } else if (
      metadata.source.version < 2.0 &&
      parseFloat((target as string) ?? "1000") >= 2.0
    ) {
      return res.status(400).json({
        message: "This recipe is old and can no longer be blended :(",
      });
    }

    res.send(recipe);
    return;
  }

  const trimmedBlend = {
    id: blendId,
    status,
    filePath,
    imagePath,
    output,
    interactions: trimInteractions(blend),
    isStatic: gifsOrStickers?.length <= 0 ?? true,
  };

  res.send(trimmedBlend);
};

const submitBlend = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id },
    body: recipe,
  } = req;

  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });

  let existingBlend = await _getBlend(id as string);

  if (!existingBlend) {
    // Blend might have expired, recreate it
    existingBlend = await addBlendToDB(id as string, uid);
  }

  if (existingBlend.createdBy != uid) {
    return res
      .status(403)
      .send({ message: "Cannot edit someone else's blend" });
  }

  const {
    title,
    images,
    externalImages,
    audios,
    slides,
    cameraClips,
    gifsOrStickers,
    texts,
    buttons,
    links,
    interactions,
    metadata,
  } = recipe;

  if (!metadata) {
    return res.status(400).json({ message: "metadata expected" });
  }
  const { source } = metadata;

  if (!source) {
    return res.status(400).json({ message: "Expected source" });
  }

  const { type, version } = source;

  if (!["WEB", "MOBILE"].includes(type)) {
    return res.status(400).json({ message: "invalid source type" });
  }

  if (
    !version ||
    version < MIN_SUPPORTED_ENCODER_VERSION ||
    version > CURRENT_ENCODER_VERSION
  ) {
    return res.status(400).json({ message: "unsupported source version" });
  }

  const imageObjects = images.map(({ fileKey, uid }) => ({
    uri: fileKey,
    uid,
  }));

  const audioObjects = audios.map(({ fileKey }) => ({ uri: fileKey }));

  const slideObjects = (slides || []).map(({ fileKey }) => ({ uri: fileKey }));

  const cameraClipObjects = cameraClips.map(({ fileKey }) => ({
    uri: fileKey,
  }));

  const now = Date.now();
  const updatedOn = DateTime.utc().toISODate();
  const params = {
    UpdateExpression:
      "SET #st = :s, statusUpdates = list_append(statusUpdates, :update), title = :title," +
      "interactions = :inter, images = :images, externalImages = :externalImages, audios = :audios," +
      "slides = :slides, cameraClips = :clips, gifsOrStickers = :gifsOrStickers, texts = :texts, buttons = :buttons, links = :links," +
      "metadata = :metadata, updatedAt = :updatedAt, updatedOn = :updatedOn REMOVE expireAt",
    ExpressionAttributeNames: {
      "#st": "status",
    },
    ExpressionAttributeValues: {
      ":s": "SUBMITTED",
      ":update": [{ status: "SUBMITTED", on: now }],
      ":title": title,
      ":inter": interactions,
      ":images": imageObjects,
      ":externalImages": externalImages,
      ":audios": audioObjects,
      ":slides": slideObjects,
      ":clips": cameraClipObjects,
      ":gifsOrStickers": gifsOrStickers,
      ":texts": texts,
      ":buttons": buttons || [],
      ":links": links || [],
      ":metadata": metadata,
      ":updatedAt": now,
      ":updatedOn": updatedOn,
    },
    Key: { id: id },
    TableName: process.env.BLEND_DYNAMODB_TABLE,
    ReturnValues: "ALL_NEW",
  };

  let updatedRecipe: { [x: string]: string | string[] };
  try {
    const dbUpdateResponse = await DynamoDB.updateItem(params);
    updatedRecipe = dbUpdateResponse.Attributes;

    await new SQS(process.env.BLEND_GEN_QUEUE_URL).sendMessage({ id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong!" });
  }

  // Add id
  updatedRecipe["id"] = id;

  res.send(updatedRecipe);
};
