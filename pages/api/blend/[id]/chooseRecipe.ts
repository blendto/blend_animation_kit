import type { NextApiRequest, NextApiResponse } from "next";
import DynamoDB from "server/external/dynamodb";
import ConfigProvider from "server/base/ConfigProvider";
import { copyObject, getObject } from "server/external/s3";
import type {
  Recipe,
  ImageMetadata,
  Interaction,
} from "server/base/models/recipe";
import sharp from "sharp";
import { checkCompatibilityWithElements } from "server/base/errors/recipeVerification";
import { withReqHandler } from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return useRecipeForBlend(req, res);
      default:
        res.status(405).end();
    }
  }
);

export const _getRecipe = async (
  id: string,
  variant: string = "9:16"
): Promise<Recipe> => {
  const recipe = await DynamoDB._().getItem({
    TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
    Key: {
      id,
      variant,
    },
  });
  return <Recipe>recipe;
};

/**
 *
 * Modifies the interaction's metadata to ensure that the image has a tight bounds
 * This adjust the recipe's hero image bounds to the target images bounds so taht
 * there is no extra area.
 *
 * @param interaction Interaction to be updated
 * @param fileKey The s3 filekey for the image
 */
const adjustSizeToFit = async (interaction: Interaction, fileKey: string) => {
  const imageFile = await getObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    fileKey
  );

  const imageFileMetadata = await sharp(imageFile).metadata();

  let { width, height } = imageFileMetadata;

  if ([5, 6, 7, 8].includes(imageFileMetadata.orientation)) {
    // 5, 6, 7, 8 orientation represents 90 or 270 degree rotated
    const temp = width;
    width = height;
    height = temp;
  }

  const metadata = interaction.metadata as ImageMetadata;
  const scale = Math.min(
    metadata.size.width / width,
    metadata.size.height / height
  );
  const targetSize = {
    width: Math.ceil(width * scale),
    height: Math.ceil(height * scale),
  };
  const widthDiff = metadata.size.width - targetSize.width;
  const heightDiff = metadata.size.height - targetSize.height;
  metadata.position = {
    dx: metadata.position.dx + widthDiff / 2,
    dy: metadata.position.dy + heightDiff / 2,
  };
  metadata.size = targetSize;
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
  const { recipeId, variant = "9:16", fileKeys, encoderVersion } = req.body;
  if (!recipeId) {
    return res
      .status(400)
      .json({ code: 400, message: "recipeId not present!" });
  }

  if (!variant) {
    return res.status(400).json({ code: 400, message: "invalid variant!" });
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

  recipe = await _getRecipe(recipeId as string, variant as string);
  if (!recipe) {
    return res.status(400).send({ message: "No such recipe" });
  }

  if (!checkCompatibilityWithElements(recipe, encoderVersion)) {
    return res.status(400).json({
      message:
        "This recipe cannot be used on this app version. Please upgrade the app.",
    });
  }

  let copyFilePromises = [];
  let interactionUpdatePromise;

  const blendImages = recipe.images.map((image) => {
    if (image.uid === recipe.recipeDetails.elements.hero.uid) {
      const interaction = recipe.interactions.find(
        (interaction) =>
          interaction.assetType == "IMAGE" && interaction.assetUid == image.uid
      );
      // Starting from 2.5, we only show the cropped area in the mobile_app instead of actually cropping the image and uploading it.
      // The hero image should not have cropRect property in a recipe as it will get replaced.
      (interaction.metadata as ImageMetadata).cropRect = null;
      if ((interaction.metadata as ImageMetadata).hasBgRemoved) {
        interactionUpdatePromise = adjustSizeToFit(
          interaction,
          fileKeys.withoutBg
        );
        return { ...image, uri: fileKeys.withoutBg };
      }
      interactionUpdatePromise = adjustSizeToFit(
        interaction,
        fileKeys.original
      );
      return { ...image, uri: fileKeys.original };
    }
    let uriParts = image.uri.split("/");
    uriParts[0] = blendId as string;
    let targetUri = uriParts.join("/");
    copyFilePromises.push(
      copyObject(
        ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
        image.uri,
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        targetUri
      )
    );
    return { ...image, uri: targetUri };
  });

  await Promise.all(copyFilePromises.concat([interactionUpdatePromise]));

  return res.send({
    ...recipe,
    metadata: {
      ...recipe.metadata,
      sourceRecipeId: recipe.id,
      sourceRecipe: { id: recipe.id, variant: recipe.variant },
    },
    id: blendId,
    images: blendImages,
  });
};
