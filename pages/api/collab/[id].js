import DynamoDB from "../../../server/external/dynamodb";
import SQS from "../../../server/external/sqs";
import {
  COLLAB_REQ_STORE_BUCKET,
  copyObject,
} from "../../../server/external/s3uploader";

const COLLABS_TABLE = "COLLABS";
const COLLABS_QUEUE_URL =
  "https://sqs.us-east-2.amazonaws.com/558879754161/collab-creation-queue";

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

  const { id: collabId, title, status, filePath } = collab;

  const trimmedCollab = {
    id: collabId,
    title,
    status,
    filePath,
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
    audios,
    slides,
    cameraClip,
    interactions,
  } = collabRequest;

  const imageObjects = images.map(({ fileKey }) => ({ uri: fileKey }));

  const audioObjects = audios.map(({ fileKey }) => ({ uri: fileKey }));

  const slideObjects = slides.map(({ fileKey }) => ({ uri: fileKey }));

  const cameraClipObjects = cameraClip.map(({ fileKey }) => ({ uri: fileKey }));

  const collabDBObject = {
    id,
    title,
    interactions,
    images: imageObjects,
    audios: audioObjects,
    slides: slideObjects,
    cameraClip: cameraClipObjects,
    status: "SUBMITTED",
  };

  try {
    await DynamoDB.putItem({
      TableName: COLLABS_TABLE,
      Item: collabDBObject,
    });

    await new SQS(COLLABS_QUEUE_URL).sendMessage({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }

  res.send(collabDBObject);
};
