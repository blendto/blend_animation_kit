import type { NextApiRequest, NextApiResponse } from "next";

import { _getBlend } from "../[id]";
import ToolkitApi, { ToolkitErrorResponse } from "server/internal/toolkit";
import DynamoDB from "server/external/dynamodb";

import ConfigProvider from "server/base/ConfigProvider";

import { doesObjectExist, getObject, uploadObject } from "server/external/s3";
import { handleNetworkExceptions, UserError } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import { RecipeList } from "server/base/models/recipeList";
import axios from "axios";

const toolkitApi = new ToolkitApi();

const FASHION_STATIC_TEMPLATE_COUNT = 51;

const STATIC_RECIPE_LIST = Array.from(
  new Array(FASHION_STATIC_TEMPLATE_COUNT),
  (x, i) => "fas-" + (i + 1).toString().padStart(4, "0")
);

export const _getRecipeLists = async ({ isEnabled = true } = {}): Promise<
  RecipeList[]
> => {
  return await DynamoDB.scanItems({
    TableName: process.env.RECIPE_LISTS_DYNAMODB_TABLE,
    FilterExpression: "isEnabled = :iE",
    ExpressionAttributeValues: { ":iE": isEnabled },
  });
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
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

interface HeroImageFileKeys {
  original: String;
}

interface SuggestRecipesRequestBody {
  fileKeys: HeroImageFileKeys;
}

const suggestRecipes = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id },
    body,
  } = req;

  const { fileKeys } = body as SuggestRecipesRequestBody;

  const blend: Blend = await _getBlend(id);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  if (!fileKeys || typeof fileKeys != "object" || !fileKeys.original) {
    res.status(400).send({ message: "Invalid filekeys" });
    return;
  }

  let originalImage: Buffer;
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
      try {
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
      } catch (ex) {
        if (axios.isAxiosError(ex)) {
          let data = "";
          for await (const chunk of ex.response.data) {
            data += chunk;
          }
          let error: ToolkitErrorResponse = JSON.parse(data);

          throw new UserError(error.message, error.code);
        }
        throw ex;
      }
    }

    const randomTemplates = STATIC_RECIPE_LIST.sort(
      () => 0.5 - Math.random()
    ).slice(0, 20);

    const recipeList = await _getRecipeLists();

    recipeList.sort(
      (a, b) =>
        (a.sortOrder || Number.MAX_SAFE_INTEGER) -
        (b.sortOrder || Number.MAX_SAFE_INTEGER)
    );

    return res.send({
      fileKeys: {
        original: fileKeys.original,
        withoutBg: bgRemovedFileKey,
      },
      suggestedRecipes: randomTemplates,
      otherRecipes: recipeList,
    });
  });
};
