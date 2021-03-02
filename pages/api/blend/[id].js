import { Empty } from "antd";
import DynamoDB from "../../../server/external/dynamodb";
import SQS from "../../../server/external/sqs";

const COLLABS_TABLE = "COLLABS";
const COLLABS_QUEUE_URL =
  "https://sqs.us-east-2.amazonaws.com/558879754161/collab-creation-queue";

const MIN_SUPPORTED_ENCODER_VERSION = 1.0;
const CURRENT_ENCODER_VERSION = 1.6;

export const _getBlend = async (id) => {
  return await DynamoDB.getItem({
    TableName: COLLABS_TABLE,
    Key: {
      id,
    },
  });
};

export default async (req, res) => {
  const { method } = req;

  switch (method) {
    case "GET":
      await getBlend(req, res);
      break;
    case "POST":
      await submitBlend(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const trimInteractions = (collab) => {
  const { interactions } = collab;

  const interactionsToRender = interactions
    .filter((interaction) => !!interaction.userInteraction)
    .map(({ assetType, metadata, userInteraction }) => ({
      assetType,
      metadata,
      userInteraction,
    }));

  return interactionsToRender;
};

const getBlend = async (req, res) => {
  const {
    query: { id, format },
  } = req;

  const blend = await _getBlend(id);

  if (!blend) {
    res.status(404).send({ message: "Blend not found!" });
    return;
  }

  const {
    id: collabId,
    title,
    status,
    filePath,
    imagePath,
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
  } = blend;

  if (format?.toUpperCase() == "RECIPE") {
    const recipe = {
      id,
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
    };

    res.send(recipe);
    return;
  }

  const trimmedBlend = {
    id: collabId,
    title,
    status,
    filePath,
    imagePath,
    interactions: trimInteractions(blend),
  };

  res.send(trimmedBlend);
};

const submitBlend = async (req, res) => {
  const {
    query: { id },
    body: recipe,
  } = req;

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

  const params = {
    UpdateExpression:
      "SET #st = :s, statusUpdates = list_append(statusUpdates, :update), title = :title," +
      "interactions = :inter, images = :images, externalImages = :externalImages, audios = :audios," +
      "slides = :slides, cameraClips = :clips, gifsOrStickers = :gifsOrStickers, texts = :texts, buttons = :buttons, links = :links," +
      "metadata = :metadata REMOVE expireAt",
    ExpressionAttributeNames: {
      "#st": "status",
    },
    ExpressionAttributeValues: {
      ":s": "SUBMITTED",
      ":update": [{ status: "SUBMITTED", on: Date.now() }],
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
      ":metadata": { source },
    },
    Key: { id: id },
    TableName: COLLABS_TABLE,
    ReturnValues: "ALL_NEW",
  };

  let updatedRecipe;
  try {
    const dbUpdateResponse = await DynamoDB.updateItem(params);
    updatedRecipe = dbUpdateResponse.Attributes;

    await new SQS(COLLABS_QUEUE_URL).sendMessage({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }

  // Add id
  updatedRecipe["id"] = id;

  res.send(updatedRecipe);
};
