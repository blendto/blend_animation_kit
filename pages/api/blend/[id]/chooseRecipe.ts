import type { NextApiRequest, NextApiResponse } from "next";
import DynamoDB from "server/external/dynamodb";
import {
  copyObject,
  COLLAB_REQ_STORE_BUCKET,
  RECIPE_INGREDIENTS_BUCKET,
} from "server/external/s3";
import { ServerError } from "server/base/errors";
import type { Recipe, ImageMetadata } from "server/base/models/recipe";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  switch (method) {
    case "POST":
      await useRecipeForBlend(req, res);
      break;
    default:
      res.status(404).json({ code: 404, message: "No such route found!" });
  }
};

export const _getRecipe = async (id: string): Promise<Recipe> => {
  return await DynamoDB.getItem({
    TableName: process.env.RECIPE_DYNAMODB_TABLE,
    Key: {
      id,
    },
  });
};

const useRecipeForBlend = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id: blendId },
    body,
  } = req;

  if (!body) {
    return res
      .status(400)
      .json({ code: 400, message: "request body is mandatory!" });
  }
  const { recipeId, fileKeys } = req.body;
  if (!recipeId) {
    return res
      .status(400)
      .json({ code: 400, message: "recipeId not present!" });
  }

  if (
    !fileKeys ||
    typeof fileKeys != "object" ||
    !fileKeys.original ||
    !fileKeys.withoutBg
  ) {
    return res.status(400).send({ message: "Invalid filekeys" });
  }

  let recipe: Recipe;

  try {
    recipe = await _getRecipe(recipeId as string);
  } catch (ex) {
    if (!(ex instanceof ServerError)) {
      console.error(ex);
    }
    return res.status(500).send({ message: "Something went wrong!" });
  }

  let copyFilePromises = [];

  const blendImages = recipe.images.map((image) => {
    if (image.uid === recipe.recipeDetails.elements.hero.uid) {
      const interaction = recipe.interactions.find(
        (interaction) =>
          interaction.assetType == "IMAGE" && interaction.assetUid == image.uid
      );
      if ((interaction.metadata as ImageMetadata).hasBgRemoved) {
        return { ...image, uri: fileKeys.withoutBg };
      }
      return { ...image, uri: fileKeys.original };
    }
    let uriParts = image.uri.split("/");
    uriParts[0] = blendId as string;
    let targetUri = uriParts.join("/");
    copyFilePromises.push(
      copyObject(
        RECIPE_INGREDIENTS_BUCKET,
        image.uri,
        COLLAB_REQ_STORE_BUCKET,
        targetUri
      )
    );
    return { ...image, uri: targetUri };
  });

  try {
    await Promise.all(copyFilePromises);
  } catch (ex) {
    if (!(ex instanceof ServerError)) {
      console.error(ex);
    }
    return res.status(500).send({ message: "Something went wrong!" });
  }

  return res.send({
    ...recipe,
    metadata: { ...recipe.metadata, sourceRecipeId: recipe.id },
    id: blendId,
    images: blendImages,
  });
};
