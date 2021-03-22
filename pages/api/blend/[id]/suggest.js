import { _getBlend } from "../[id]";
import ToolkitApi from "../../../../server/internal/toolkit";

import {
  COLLAB_REQ_STORE_BUCKET,
  doesObjectExist,
  getObject,
  uploadObject,
} from "../../../../server/external/s3";
import { handleNetworkExceptions } from "../../../../server/base/errors";

const toolkitApi = new ToolkitApi();

const STATIC_RECIPE_LIST = [
  "fas-0001",
  "fas-0002",
  "fas-0003",
  "fas-0004",
  "fas-0005",
  "fas-0006",
  "fas-0007",
  "fas-0008",
];

export default async (req, res) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await suggestRecipes(req, res);
      break;
    default:
      return res
        .status(500)
        .json({ code: 500, message: "Something went wrong!" });
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
  return await handleNetworkExceptions(res, async () => {
    originalImage = await getObject(COLLAB_REQ_STORE_BUCKET, fileKeys.original);

    const fileKeyParts = fileKeys.original.split("/");

    const [fileNameWithExt] = fileKeyParts.slice(-1);

    const fileNameWithoutExt = fileNameWithExt.split(".").slice(0, -1).join("");

    const bgRemovedFileName = `${fileNameWithoutExt}-bg-removed.png`;

    const bgRemovedFileKey = [
      ...fileKeyParts.slice(0, -1),
      "/",
      bgRemovedFileName,
    ].join("");

    const bgRemovedElementExists = await doesObjectExist(
      COLLAB_REQ_STORE_BUCKET,
      bgRemovedFileKey
    );

    if (!bgRemovedElementExists) {
      // As of now this logic just works by assuming file name is unique
      // This works because we generate a random file name when we store the file name
      // Re-evaluate in the future
      const bgRemoved = await toolkitApi.removeBg(
        originalImage,
        fileNameWithExt,
        true
      );

      await uploadObject(COLLAB_REQ_STORE_BUCKET, bgRemovedFileKey, bgRemoved);
    }

    return res.send({
      fileKeys: {
        original: fileKeys.original,
        withoutBg: bgRemovedFileKey,
      },
      suggestedRecipes: STATIC_RECIPE_LIST,
    });
  });
};
