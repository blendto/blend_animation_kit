import "reflect-metadata";
import archiver from "archiver";
import { inject, injectable } from "inversify";
import MemoryStream from "memorystream";
import sharp from "sharp";
import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";

import { IService } from "server/service";
import DynamoDB from "server/external/dynamodb";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";
import { Recipe } from "server/base/models/recipe";
import { UserError } from "server/base/errors";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import {
  createSignedUploadUrl,
  getObject,
  uploadObject,
} from "server/external/s3";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "server/helpers/constants";
import logger from "server/base/Logger";
import { bufferToStream } from "server/helpers/bufferUtils";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

@injectable()
export class RecipeService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  async getRecipe(id: string, variant = "9:16"): Promise<Recipe> {
    const recipe = await this.dataStore.getItem({
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      Key: { id, variant },
    });
    return <Recipe>recipe;
  }

  async getRecipeOrFail(id: string, variant = "9:16"): Promise<Recipe> {
    const recipe = await this.getRecipe(id, variant);
    if (!recipe) {
      throw new UserError("Invalid recipe id and/or variant");
    }
    return recipe;
  }

  async saveRecipeThumbnail(id: string, variant = "9:16"): Promise<void> {
    const recipe = (await this.dataStore.getItem({
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      Key: { id, variant },
    })) as Recipe;

    if (!recipe) {
      throw new UserError("Invalid recipe", "404");
    }

    const { fileName, fileKey } = RecipeService.thumbnailFileKey(recipe);
    const uploadDetails = (await createSignedUploadUrl(
      fileName,
      ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
      VALID_UPLOAD_IMAGE_EXTENSIONS,
      {
        outFileKey: fileKey,
        maxSize: MAX_FILE_SIZE,
      }
    )) as PresignedPost;

    await new VesApi().savePreview({
      body: recipe,
      schema: ExportRequestSchema.Recipe,
      uploadDetails,
    });

    await this.dataStore.updateItem({
      UpdateExpression: "SET #thumbnail = :thumbnail",
      ExpressionAttributeNames: {
        "#thumbnail": "thumbnail",
      },
      ExpressionAttributeValues: {
        ":thumbnail": fileKey,
      },
      Key: { id, variant },
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  private static thumbnailFileKey(recipe: Recipe) {
    const isStatic: boolean =
      recipe.gifsOrStickers === null || recipe.gifsOrStickers.length === 0;
    const fileName = isStatic ? `${Date.now()}.jpeg` : `${Date.now()}.webp`;
    const subFolder = recipe.variant.replaceAll(":", "-");

    const fileKey = `${recipe.id}/${subFolder}/thumbnail/${fileName}`;
    return { fileName, fileKey };
  }

  async optimize(
    recipe: Recipe
  ): Promise<{ zipURL: string; zipWithoutHeroURL: string }> {
    const zipper = this.initImagesZipper();
    const zip = this.initImagesZip(
      `Images zipped. Zip file size: ${zipper.pointer()}`
    );
    zipper.pipe(zip);

    const zipperWithoutHero = this.initImagesZipper();
    const zipWithoutHero = this.initImagesZip(
      `Images (without hero) zipped. Zip file size: ${zipperWithoutHero.pointer()}`
    );
    zipperWithoutHero.pipe(zipWithoutHero);

    // Pipe the zip (with hero image) to a buffer to monitor for large sizes
    const bytes = [];
    let buff: Buffer;
    zip.on("data", (chunk) => {
      bytes.push(chunk);
    });
    zip.on("close", () => {
      buff = Buffer.concat(bytes);
      if (buff.byteLength > 1e6 * 2.5) {
        logger.warn({
          op: "FOUND_UNUSUALLY_LARGE_RECIPE_IMAGE_ASSETS_ZIP",
          details: {
            recipeId: recipe.id,
            variant: recipe.variant,
            sizeInMBs: buff.byteLength / 1e6,
          },
        });
      }
    });

    const { images } = recipe;

    const uploadPromises = [];

    await Promise.all(
      recipe.images.map(async (imageData, index) => {
        let image: Buffer;
        try {
          image = await getObject(
            ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
            imageData.uri
          );
        } catch (err) {
          throw new UserError(
            `Image download failed. Recipe is possibly corrupted. Id: ${recipe.id}. Variant: ${recipe.variant}. Image URI: ${imageData.uri}`
          );
        }

        if (!imageData.uri.endsWith("-optimized.webp")) {
          logger.debug(`Optimize ${imageData.uri}`);
          const compressedImageOutput = await this.compressImage(image);
          if (compressedImageOutput.data.byteLength < image.byteLength) {
            const optimizedFileURI =
              imageData.uri.substring(0, imageData.uri.lastIndexOf(".")) +
              "-optimized.webp";
            uploadPromises.push(
              uploadObject(
                ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
                optimizedFileURI,
                compressedImageOutput.data
              )
            );
            images[index].uri = optimizedFileURI;

            image = compressedImageOutput.data;
          }
        }

        logger.debug(`Zip ${imageData.uri}`);
        const name = imageData.uri.split(`${recipe.id}/`)[1];
        zipper.append(image, { name });
        if (recipe.recipeDetails.elements.hero?.uid !== imageData.uid) {
          zipperWithoutHero.append(image, { name });
        }
      })
    );
    await zipper.finalize();
    await zipperWithoutHero.finalize();

    const now = Date.now();
    const zipURL = `${recipe.id}/${recipe.variant}/zip/image-assets-${now}.zip`;
    const zipWithoutHeroURL = `${recipe.id}/${recipe.variant}/zip/image-assets-without-hero-${now}.zip`;
    uploadPromises.push(
      uploadObject(ConfigProvider.RECIPE_INGREDIENTS_BUCKET, zipURL, buff)
    );
    uploadPromises.push(
      uploadObject(
        ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
        zipWithoutHeroURL,
        zipWithoutHero
      )
    );
    await Promise.all(uploadPromises);

    const recipeDetails = {
      ...recipe.recipeDetails,
      assets: {
        ...recipe.recipeDetails?.assets,
        images: {
          ...recipe.recipeDetails?.assets?.images,
          zipURL,
          zipWithoutHeroURL,
        },
      },
    };
    await this.dataStore.updateItem({
      UpdateExpression: "SET #rD = :rD, #i = :i",
      ExpressionAttributeNames: {
        "#rD": "recipeDetails",
        "#i": "images",
      },
      ExpressionAttributeValues: {
        ":rD": recipeDetails,
        ":i": images,
      },
      Key: { id: recipe.id, variant: recipe.variant },
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });

    return { zipURL, zipWithoutHeroURL };
  }

  private initImagesZipper() {
    const zipper = archiver("zip", {
      zlib: { level: 9 },
    });
    zipper.on("warning", (err) => {
      throw err;
    });
    zipper.on("error", (err) => {
      throw err;
    });
    return zipper;
  }

  private initImagesZip(onCloseMessage: string) {
    const zip = new MemoryStream();
    zip.on("error", (err) => {
      throw err;
    });
    zip.on("close", () => {
      logger.info(onCloseMessage);
    });
    return zip;
  }

  private async compressImage(image: Buffer) {
    return await sharp(image)
      .resize({
        width: 3840,
        height: 3840,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat("webp", {
        quality: 90,
      })
      .toBuffer({ resolveWithObject: true });
  }
}
