import DynamoDB from "server/external/dynamodb";
import SQS from "server/external/sqs";
import { DateTime } from "luxon";
import type { NextApiResponse } from "next";
import { Recipe } from "server/base/models/recipe";
import { BlendStatus, BlendVersion } from "server/base/models/blend";
import {
  CURRENT_ENCODER_VERSION,
  MIN_SUPPORTED_ENCODER_VERSION,
} from "server/constants";
import { checkCompatibilityWithElements } from "server/base/errors/recipeVerification";
import ConfigProvider from "server/base/ConfigProvider";
import logger from "server/base/Logger";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getBlend(req, res);
      case "POST":
        return ensureAuth(submitBlend, req, res);
      case "DELETE":
        return ensureAuth(deleteBlend, req, res);
      default:
        res.status(405).end();
    }
  }
);

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

const deleteBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
  } = req;

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  const blend = await blendService.getBlend(id as string);

  if (!blend) {
    return res.status(404).send({ message: "Blend not found!" });
  }

  if (blend.createdBy != req.uid) {
    return res.status(403).send({ message: "Forbidden" });
  }

  if (blend.status != "GENERATED") {
    try {
      await DynamoDB._().deleteItem({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        Key: {
          id: id,
        },
      });
    } catch (err) {
      logger.error(err);
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
        ":s": BlendStatus.Deleted,
        ":update": [{ status: BlendStatus.Deleted, on: now }],
        ":updatedAt": now,
        ":updatedOn": updatedOn,
      },
      Key: { id: id },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    };

    try {
      await DynamoDB._().updateItem(params);
    } catch (err) {
      logger.error(err);
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
const getBlend = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const {
    query: { id, format, target },
  } = req;
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  let blend = await blendService.getBlend(id as string, BlendVersion.current);

  if (!blend || blend?.status === BlendStatus.Deleted) {
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

const submitBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
    body: recipe,
  } = req;
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  let existingBlend = await blendService.getBlend(id as string);

  if (!existingBlend) {
    // Blend might have expired, recreate it
    existingBlend = await blendService.addBlendToDB(id as string, req.uid);
  }

  if (existingBlend.createdBy != req.uid) {
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
    TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
    ReturnValues: "ALL_NEW",
  };

  let updatedRecipe: { [x: string]: string | string[] };
  try {
    const dbUpdateResponse = await DynamoDB._().updateItem(params);
    updatedRecipe = dbUpdateResponse.Attributes;

    await new SQS(ConfigProvider.BLEND_GEN_QUEUE_URL).sendMessage({ id });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: "Something went wrong!" });
  }

  // Add id
  updatedRecipe["id"] = id;

  res.send(updatedRecipe);
};
