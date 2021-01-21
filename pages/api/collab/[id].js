import DynamoDB from "../../../server/external/dynamodb";
import SQS from "../../../server/external/sqs";
import {
  COLLAB_REQ_STORE_BUCKET,
  copyObject,
} from "../../../server/external/s3uploader";

const COLLABS_TABLE = "COLLABS";
const COLLABS_QUEUE_URL =
  "https://sqs.us-east-2.amazonaws.com/558879754161/collab-creation-queue";

const MIN_SUPPORTED_ENCODER_VERSION = 0.3;
const CURRENT_ENCODER_VERSION = 1.6;

export const _getCollab = async (id) => {
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
      await getCollab(req, res);
      break;
    case "POST":
      await submitCollab(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const getCollab = async (req, res) => {
  const {
    query: { id },
  } = req;

  const collab = await _getCollab(id);

  if (!collab) {
    res.status(404).send({ message: "Collab not found!" });
    return;
  }

  const { id: collabId, title, status, filePath, imagePath } = collab;

  const trimmedCollab = {
    id: collabId,
    title,
    status,
    filePath,
    imagePath,
  };

  res.send(trimmedCollab);
};

const submitCollab = async (req, res) => {
  const {
    query: { id },
    body: collabRequest,
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
    interactions,
    metadata,
  } = collabRequest;

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

  const imageObjects = images.map(({ fileKey, file, imageType }) => ({
    uri: fileKey,
    file,
    imageType,
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
      "slides = :slides, cameraClips = :clips, gifsOrStickers = :gifsOrStickers, texts = :texts, buttons = :buttons, metadata = :metadata REMOVE expireAt",
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
      ":buttons": buttons,
      ":metadata": { source },
    },
    Key: { id: id },
    TableName: COLLABS_TABLE,
    ReturnValues: "ALL_NEW",
  };

  let updatedCollab;
  try {
    const dbUpdateResponse = await DynamoDB.updateItem(params);
    updatedCollab = dbUpdateResponse.Attributes;

    await new SQS(COLLABS_QUEUE_URL).sendMessage({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }

  // Add id
  updatedCollab["id"] = id;

  res.send(updatedCollab);
};
