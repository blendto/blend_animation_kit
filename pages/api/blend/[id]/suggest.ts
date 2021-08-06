import type { NextApiRequest, NextApiResponse } from "next";

import { _getBlend } from "../[id]";
import ToolkitApi, { ToolkitErrorResponse } from "server/internal/toolkit";

import ConfigProvider from "server/base/ConfigProvider";

import { doesObjectExist, getObject, uploadObject } from "server/external/s3";
import { handleServerExceptions, UserError } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import axios from "axios";
import RecoEngineApi from "server/internal/reco-engine";

const toolkitApi = new ToolkitApi();
const recoEngineApi = new RecoEngineApi();

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await suggestRecipes(req, res);
      break;
    default:
      return res.status(404).json({ code: 404, message: "Wrong page/" });
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

  const blend: Blend = await _getBlend(id as string);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  if (!fileKeys || typeof fileKeys != "object" || !fileKeys.original) {
    res.status(400).send({ message: "Invalid filekeys" });
    return;
  }

  let originalImage: Buffer;
  return await handleServerExceptions(res, async () => {
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

          let errorMessage = error.message;

          if (error.code == "unknown_foreground") {
            errorMessage = "Unable to remove background";
          }

          throw new UserError(errorMessage, error.code);
        }
        throw ex;
      }
    }

    const recipeLists = (
      await recoEngineApi.suggestRecipeLists(bgRemovedFileKey)
    ).suggestedRecipeCategories;

    recipeLists.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    );

    // For backward compatibility, use recipes to fill 9:16 ones in recipeIds
    recipeLists.forEach((list) => {
      list.recipeIds = list.recipes
        .filter(({ variant }) => variant == "9:16")
        .map(({ id }) => id);
    });

    const randomTemplates = recipeLists
      .map((list) => list.recipeIds)
      .flat()
      .sort(() => 0.5 - Math.random())
      .slice(0, 20);

    return res.send({
      fileKeys: {
        original: fileKeys.original,
        withoutBg: bgRemovedFileKey,
      },
      suggestedRecipes: randomTemplates,
      otherRecipes: recipeLists,
    });
  });
};
