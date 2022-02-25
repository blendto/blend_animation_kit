/* eslint-disable no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import DynamoDB from "server/external/dynamodb";
import SQS from "server/external/sqs";
import firebase from "server/external/firebase";
import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import { Recipe } from "server/base/models/recipe";
import { handleServerExceptions } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import {
  CURRENT_ENCODER_VERSION,
  MIN_SUPPORTED_ENCODER_VERSION,
} from "server/constants";
import { checkCompatibilityWithElements } from "server/base/errors/recipeVerification";
import ConfigProvider from "server/base/ConfigProvider";
import { addBlendToDB, backfillBlendOutput, BlendVersion } from "../blend";

// eslint-disable-next-line no-underscore-dangle
export const _getBlend = async (
  id: string,
  version: BlendVersion = BlendVersion.current
): Promise<Blend> => {
  let blend = await DynamoDB._().getItem({
    TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
    Key: {
      id,
      version,
    },
  });

  if (!blend) {
    // TODO: Remove this post migration. This is a HACK to fix consistancy issues.
    blend = await DynamoDB._().getItem({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      Key: {
        id,
      },
    });
  }

  if (!blend) {
    return null;
  }

  return backfillBlendOutput(<Blend>blend);
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

  if (blend.createdBy !== uid) {
    return res.status(403).send({ message: "Forbidden" });
  }

  if (blend.status !== "GENERATED") {
    try {
      await DynamoDB._().deleteItem({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        Key: {
          id,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Something went wrong!" });
    }
  } else {
    const now = Date.now();
    const updatedOn = DateTime.utc().toISODate();
    const params = {
      UpdateExpression:
        "SET #st = :s, statusUpdates = list_append(statusUpdates, :update), " +
        "updatedAt = :updatedAt, updatedOn = :updatedOn",
      ExpressionAttributeNames: {
        "#st": "status",
      },
      ExpressionAttributeValues: {
        ":s": "DELETED",
        ":update": [{ status: "DELETED", on: now }],
        ":updatedAt": now,
        ":updatedOn": updatedOn,
      },
      Key: { id },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    };

    try {
      await DynamoDB._().updateItem(params);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Something went wrong!" });
    }
  }

  // Hack: To avoid consistency issues coz the app reads /blend immediately after this,
  // We wait 1 second before responding
  await new Promise((r) => setTimeout(r, 1000));

  res.send({ status: "Success" });
};

/**
 * Returns the blend with id passed in request query.
 * Retrieves the generated version by default, unless specified otherwise in the version
 * or not generated yet.
 */
const getBlend = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id, format, target },
  } = req;

  const blend = await _getBlend(id as string, BlendVersion.current);

  if (!blend || blend?.status === "DELETED") {
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

  if (
    !checkCompatibilityWithElements(
      blend as Recipe,
      parseFloat(target as string)
    )
  ) {
    return res.status(400).json({
      message:
        "This recipe cannot be remixed on this app version. Please upgrade the app.",
    });
  }

  if ((format as string)?.toUpperCase() === "RECIPE") {
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

  if (existingBlend.createdBy !== uid) {
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

  if (!["WEB", "MOBILE"].includes(type as string)) {
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
    Key: { id },
    TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
    ReturnValues: "ALL_NEW",
  };

  let updatedRecipe: { [x: string]: string | string[] };
  try {
    const dbUpdateResponse = await DynamoDB._().updateItem(params);
    updatedRecipe = dbUpdateResponse.Attributes;

    await new SQS(ConfigProvider.BLEND_GEN_QUEUE_URL).sendMessage({ id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong!" });
  }

  // Add id
  updatedRecipe.id = id;

  res.send(updatedRecipe);
};
