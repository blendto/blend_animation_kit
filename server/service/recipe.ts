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
import {
  BrandingInfoMetadata,
  ElementSource,
  Interaction,
  Recipe,
} from "server/base/models/recipe";
import { UserError } from "server/base/errors";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import {
  copyObject,
  createSignedUploadUrl,
  getObject,
  uploadObject,
} from "server/external/s3";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "server/helpers/constants";
import logger from "server/base/Logger";
import { DateTime } from "luxon";
import { BlendToRecipeConverter } from "server/engine/blend/recipeConverter";
import { BrandingEntity, BrandingInfoType } from "server/repositories/branding";
import ConfigService from "./config";

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

@injectable()
export class RecipeService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.ConfigService) configService: ConfigService;

  async create(recipe: Recipe): Promise<void> {
    const imageDestinationURIs = BlendToRecipeConverter.imageDestinationURIs(
      recipe.images,
      ElementSource.recipe,
      recipe.id
    );
    await Promise.all(
      recipe.images.map((i) =>
        copyObject(
          i.source === ElementSource.recipe
            ? ConfigProvider.RECIPE_INGREDIENTS_BUCKET
            : ConfigProvider.BLEND_INGREDIENTS_BUCKET,
          i.uri,
          ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
          imageDestinationURIs[i.uid]
        )
      )
    );
    recipe.images = recipe.images.map((i) => ({
      ...i,
      uri: imageDestinationURIs[i.uid],
      source: ElementSource.recipe,
    }));
    recipe.thumbnail = await this.generateRecipeThumbnail(recipe);

    recipe.updatedOn = DateTime.utc().toISODate();
    recipe.updatedAt = Date.now();
    await this.dataStore.putItem({
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      Item: recipe,
    });
  }

  async getRecipe(id: string, variant = "9:16"): Promise<Recipe> {
    const recipe = await this.dataStore.getItem({
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      Key: { id, variant },
    });
    return <Recipe>recipe;
  }

  async getRecipeOrFail(id: string, variant?: string): Promise<Recipe> {
    const recipe = await this.getRecipe(id, variant);
    if (!recipe) {
      throw new UserError("Invalid recipe id and/or variant");
    }
    return recipe;
  }

  async getRecipes(
    Keys: { [key: string]: any }[],
    ProjectionExpression: string
  ): Promise<Partial<Recipe>[]> {
    const recipes = await this.dataStore.batchGetItems({
      RequestItems: {
        [ConfigProvider.RECIPE_DYNAMODB_TABLE]: { Keys, ProjectionExpression },
      },
    });
    return recipes[ConfigProvider.RECIPE_DYNAMODB_TABLE] as Partial<Recipe>[];
  }

  async generateRecipeThumbnail(recipe: Recipe): Promise<string> {
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

    return fileKey;
  }

  async saveRecipeThumbnail(recipe: Recipe): Promise<void> {
    const fileKey = await this.generateRecipeThumbnail(recipe);

    await this.dataStore.updateItem({
      UpdateExpression: "SET #thumbnail = :thumbnail",
      ExpressionAttributeNames: {
        "#thumbnail": "thumbnail",
      },
      ExpressionAttributeValues: {
        ":thumbnail": fileKey,
      },
      Key: { id: recipe.id, variant: recipe.variant },
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  static thumbnailFileName(recipe: Recipe) {
    const isStatic: boolean =
      recipe.gifsOrStickers === null || recipe.gifsOrStickers.length === 0;
    return isStatic ? `${Date.now()}.jpeg` : `${Date.now()}.webp`;
  }

  private static thumbnailFileKey(recipe: Recipe) {
    const fileName = RecipeService.thumbnailFileName(recipe);
    const subFolder = recipe.variant.replaceAll(":", "-");

    const fileKey = `${recipe.id}/${subFolder}/thumbnail/${fileName}`;
    return { fileName, fileKey };
  }

  async optimize(recipe: Recipe): Promise<{
    optimized: boolean;
    zipURL?: string;
    zipWithoutHeroURL?: string;
  }> {
    const log: Record<string, unknown> = {
      op: "OPTIMIZE_RECIPE",
      id: recipe.id,
      variant: recipe.variant,
    };

    const zipper = this.initImagesZipper();
    const zip = this.initImagesZip();
    zipper.pipe(zip);

    const zipperWithoutHero = this.initImagesZipper();
    const zipWithoutHero = this.initImagesZip();
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

    const optimizedImages: {
      name: string;
      sizeInBytes: {
        before: number;
        after: number;
      };
      sizeDecreaseInPercentage: number;
    }[] = [];
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
            optimizedImages.push({
              name: images[index].uri,
              sizeInBytes: {
                before: image.byteLength,
                after: compressedImageOutput.data.byteLength,
              },
              sizeDecreaseInPercentage:
                ((image.byteLength - compressedImageOutput.data.byteLength) /
                  image.byteLength) *
                100,
            });
          }
        }

        const name = imageData.uri.split(`${recipe.id}/`)[1];
        zipper.append(image, { name });
        if (recipe.recipeDetails.elements.hero?.uid !== imageData.uid) {
          zipperWithoutHero.append(image, { name });
        }
      })
    );

    if (optimizedImages.length < 1) {
      return { optimized: false };
    }

    await zipper.finalize();
    await zipperWithoutHero.finalize();
    log.optimizedImages = optimizedImages;
    log.sizeInBytes = {
      withHero: zipper.pointer(),
      withoutHero: zipperWithoutHero.pointer(),
    };

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

    logger.info(log);
    return { optimized: true, zipURL, zipWithoutHeroURL };
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

  private initImagesZip() {
    const zip = new MemoryStream();
    zip.on("error", (err) => {
      throw err;
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

  async replaceBrandingInfo(
    recipe: Recipe,
    brandingProfile: BrandingEntity,
    ip: string,
    replacementBrandingLogo?: string
  ) {
    if (recipe.branding?.logo) {
      if (replacementBrandingLogo) {
        recipe.branding.logo.data.source = ElementSource.web;
        recipe.branding.logo.data.uri = replacementBrandingLogo;
      } else if (brandingProfile.logos.primaryEntry) {
        recipe.branding.logo.data.uri = brandingProfile.logos.primaryEntry;
      } else {
        delete recipe.branding.logo;
        recipe.interactions = recipe.interactions.filter(
          (i: Interaction) => i.metadata.$ !== "BrandingLogoMetadata"
        );
      }
    }

    if (recipe.branding?.info) {
      const missingHandles: BrandingInfoType[] = [];
      recipe.branding.info.data.forEach((item, index) => {
        const itemFromProfile = brandingProfile.info.find(
          (pItem) => item.type === pItem.type
        );
        if (!itemFromProfile) {
          missingHandles.push(recipe.branding.info.data[index].type);
          delete recipe.branding.info.data[index];
        } else {
          recipe.branding.info.data[index].value = itemFromProfile.value;
        }
      });

      if (missingHandles.length) {
        recipe.branding.info.data = recipe.branding.info.data.filter(
          (d) => !!d
        );
        const orderedHandleTypes = (
          await this.configService.branding(ip)
        ).info.countryWiseSortedHandles.filter(
          (type) => !recipe.branding.info.data.find((i) => i.type === type)
        );
        let handleTypesIndex = 0;
        const infoInteractionMetadata = recipe.interactions.find(
          (i) => i.metadata.$ === "BrandingInfoMetadata"
        ).metadata as BrandingInfoMetadata;

        while (
          missingHandles.length &&
          handleTypesIndex < orderedHandleTypes.length
        ) {
          const matchingHandle = brandingProfile.info.find(
            // eslint-disable-next-line no-loop-func
            (i) => i.type === orderedHandleTypes[handleTypesIndex]
          );
          if (matchingHandle) {
            recipe.branding.info.data.push({
              type: matchingHandle.type,
              value: matchingHandle.value,
            });
            const deletedInfoType = missingHandles.pop();
            infoInteractionMetadata.transforms?.forEach((t) => {
              if (t.handle === deletedInfoType) {
                t.handle = matchingHandle.type;
              }
            });
          }
          handleTypesIndex += 1;
        }

        while (missingHandles.length) {
          const deletedInfoType = missingHandles.pop();
          if (infoInteractionMetadata.transforms?.length) {
            infoInteractionMetadata.transforms =
              infoInteractionMetadata.transforms.filter(
                (t) => t.handle !== deletedInfoType
              );
          }
        }
      }

      if (recipe.branding.info.data.length < 1) {
        delete recipe.branding.info;
        recipe.interactions = recipe.interactions.filter(
          (i: Interaction) => i.metadata.$ !== "BrandingInfoMetadata"
        );
      }
    }
  }
}
