import { _getBlend } from "../[id]";
import { UserError, ServerError } from "server/base/errors";
import ToolkitApi from "../../../../server/internal/toolkit";

import {
  COLLAB_REQ_STORE_BUCKET,
  doesObjectExist,
  getObject,
} from "../../../../server/external/s3";

const toolkitApi = new ToolkitApi();

export default async (req, res) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await suggestRecipes(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const suggestRecipes = async (req, res) => {
  const {
    query: { id },
    body,
  } = req;

  const { fileKeys } = body;

  const blend = await _getBlend(id);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  if (!fileKeys || typeof fileKeys != "object" || !fileKeys.original) {
    res.status(400).send({ message: "Invalid filekeys" });
    return;
  }

  let originalImage;
  try {
    originalImage = await getObject(COLLAB_REQ_STORE_BUCKET, fileKeys.original);
  } catch (err) {
    if (err instanceof UserError) {
      return res.status(400).send({ message: err.message });
    }
    return res.status(500).send({ message: err.message });
  }

  const bgRemoved = await toolkitApi.removeBg(originalImage);

  res.setHeader("Content-Type", "image/png");
  return res.send(bgRemoved);
};
