import { ServerError, UserError } from "../../server/base/errors";
import {
  COLLAB_REQ_STORE_BUCKET,
  copyObject,
  TEMP_FILE_STORE_BUCKET,
} from "../../server/external/s3uploader";
import { nanoid } from "nanoid";
import DynamoDB from "../../server/external/dynamodb";
import SQS from "../../server/external/sqs";

const COLLABS_TABLE = "COLLABS";
const COLLABS_QUEUE_URL =
  "https://sqs.us-east-2.amazonaws.com/558879754161/collab-creation-queue";

export default async (req, res) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await createCollab(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const createCollab = async (req, res) => {
  const collabRequest = req.body;

  const { title, images, audios, interactions } = collabRequest;

  let collabRequestId;

  do {
    collabRequestId = nanoid(8);
    try {
      const item = await DynamoDB.getItem({
        TableName: COLLABS_TABLE,
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

  const copyPromises = [];

  const imageObjects = [];

  images.forEach(({ fileKey }) => {
    const imageUri = `${collabRequestId}/${fileKey}`;
    const promise = copyObject(
      COLLAB_REQ_STORE_BUCKET,
      `/${TEMP_FILE_STORE_BUCKET}/${fileKey}`,
      imageUri
    );
    imageObjects.push({ uri: imageUri });
    copyPromises.push(promise);
  });

  const audioObjects = [];

  audios.forEach(({ fileKey }) => {
    const audioUri = `${collabRequestId}/${fileKey}`;
    const promise = copyObject(
      COLLAB_REQ_STORE_BUCKET,
      `/${TEMP_FILE_STORE_BUCKET}/${fileKey}`,
      audioUri
    );
    audioObjects.push({ uri: audioUri });
    copyPromises.push(promise);
  });

  try {
    await Promise.all(copyPromises);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
    return;
  }

  const collabDBObject = {
    id: collabRequestId,
    title,
    interactions,
    images: imageObjects,
    audios: audioObjects,
    status: "SUBMITTED",
  };

  try {
    await DynamoDB.putItem({
      TableName: COLLABS_TABLE,
      Item: collabDBObject,
    });

    await new SQS(COLLABS_QUEUE_URL).sendMessage({ id: collabRequestId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }

  res.send(collabDBObject);
};
