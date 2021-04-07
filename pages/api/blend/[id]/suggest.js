import { _getBlend } from "../[id]";
import ToolkitApi from "../../../../server/internal/toolkit";

import ConfigProvider from "../../../../server/base/ConfigProvider";

import {
  doesObjectExist,
  getObject,
  uploadObject,
} from "../../../../server/external/s3";
import { handleNetworkExceptions } from "../../../../server/base/errors";

const toolkitApi = new ToolkitApi();

const FASHION_STATIC_TEMPLATE_COUNT = 51;

const STATIC_RECIPE_LIST = Array.from(
  new Array(FASHION_STATIC_TEMPLATE_COUNT),
  (x, i) => "fas-" + (i + 1).toString().padStart(4, "0")
);

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
    originalImage = await getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      fileKeys.original
    );

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
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
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

      await uploadObject(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        bgRemovedFileKey,
        bgRemoved
      );
    }

    const randomTemplates = STATIC_RECIPE_LIST.sort(
      () => 0.5 - Math.random()
    ).slice(0, 20);

    return res.send({
      fileKeys: {
        original: fileKeys.original,
        withoutBg: bgRemovedFileKey,
      },
      suggestedRecipes: randomTemplates,
    });
  });
};
