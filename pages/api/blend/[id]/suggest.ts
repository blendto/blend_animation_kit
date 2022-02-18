import type { NextApiRequest, NextApiResponse } from "next";
import uniqWith from "lodash/uniqWith";
import isEqual from "lodash/isEqual";
import take from "lodash/take";
import sharp from "sharp";

import { _getBlend } from "../[id]";

import ToolkitApi, { ToolkitErrorResponse } from "server/internal/toolkit";

import ConfigProvider from "server/base/ConfigProvider";
import DynamoDB from "server/external/dynamodb";
import firebase from "server/external/firebase";
import {
  copyObject,
  doesObjectExist,
  getObject,
  uploadObject,
} from "server/external/s3";
import { handleServerExceptions, UserError } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import axios from "axios";
import RecoEngineApi from "server/internal/reco-engine";
import { IncomingMessage } from "node:http";
import { RecipeUtils } from "server/base/models/recipe";
import { UserAgentDetails } from "server/base/models/userAgentDetails";
import {
  HeroImage,
  HeroImageFileKeys,
  createBlendBucketFileKeys,
} from "server/base/models/heroImage";
import { BlendService } from "server/service/blend";
import HeroImageService from "server/service/heroImage";
import { getUserAgentDetails } from "pages/api/whoami";
import { DynamoBasedServiceLocator, IServiceLocator } from "server/service";

const toolkitApi = new ToolkitApi();
const recoEngineApi = new RecoEngineApi();

const _getRecentBlends = async (uid: string) => {
  return <Blend[]>(
    await DynamoDB._().queryItems({
      TableName: process.env.BLEND_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "created-by-idx",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
        ":generated": "GENERATED",
      },
      ProjectionExpression: "id, metadata",
      FilterExpression: "#status = :generated",
      ScanIndexForward: false,
      Limit: 20,
    })
  ).Items;
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const serviceLocator = DynamoBasedServiceLocator.instance;
  switch (method) {
    case "POST":
      await suggestRecipes(req, res, serviceLocator);
      break;
    default:
      return res.status(404).json({ code: 404, message: "Wrong page/" });
  }
};

interface SuggestRecipesRequestBody {
  fileKeys: HeroImageFileKeys;
  multipleAspectRatios?: boolean;
  heroImageId?: string;
}

function constructBgRemovedFileKey(fileKeys: HeroImageFileKeys) {
  const fileKeyParts = fileKeys.original.split("/");

  const [fileNameWithExt] = fileKeyParts.slice(-1);

  const fileNameWithoutExt = fileNameWithExt.split(".").slice(0, -1).join("");

  const bgRemovedFileName = `${fileNameWithoutExt}-bg-removed.png`;

  const bgRemovedFileKey = [
    ...fileKeyParts.slice(0, -1),
    "/",
    bgRemovedFileName,
  ].join("");
  return { bgRemovedFileKey, fileNameWithExt };
}

async function createBgRemovedImage(
  originalImage: Buffer,
  fileNameWithExt: string,
  fileKeys: HeroImageFileKeys,
  bgRemovedFileKey: string
) {
  {
    const metadata = await sharp(originalImage).metadata();

    if (
      !["jpeg", "jpg"].includes(metadata.format) ||
      metadata.size > 1024 * 1024 * 10
    ) {
      // failOnError: false helps blow past errors like
      // "VipsJpeg: Invalid SOS parameters for sequential JPEG"
      // https://github.com/lovell/sharp/issues/1578
      originalImage = await sharp(originalImage, { failOnError: false })
        .resize({
          width: 3840,
          height: 3840,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat("jpeg")
        .toBuffer();
      const resizedImageMetadata = await sharp(originalImage).metadata();
      console.info(
        `resized image to size ${resizedImageMetadata.size} and dims ${resizedImageMetadata.width} x ${resizedImageMetadata.height}`
      );
    }

    // As of now this logic just works by assuming file name is unique
    // This works because we generate a random file name when we store the file name
    // Re-evaluate in the future
    let bgRemoved: IncomingMessage;
    try {
      bgRemoved = await toolkitApi.removeBg(
        originalImage,
        fileNameWithExt,
        true
      );
    } catch (ex) {
      if (axios.isAxiosError(ex)) {
        console.error(
          "Remove BG Failed. Key: " +
            fileKeys.original +
            " Error message: " +
            ex.message
        );
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

    try {
      await uploadObject(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        bgRemovedFileKey,
        bgRemoved
      );
    } catch (ex) {
      if (axios.isAxiosError(ex)) {
        console.error(
          "Upload to S3 Failed. Status Code: " +
            ex.response.status +
            ". Message: " +
            ex.response?.data ?? "No response"
        );
        throw new UserError(
          "Something went wrong while removing background! Try again!"
        );
      }
      throw ex;
    }
  }
}

const suggestRecipes = async (
  req: NextApiRequest,
  res: NextApiResponse,
  serviceLocator: IServiceLocator
) => {
  const {
    query: { id },
    body,
  } = req;

  const { fileKeys, multipleAspectRatios, heroImageId } =
    body as SuggestRecipesRequestBody;

  const blend: Blend = await _getBlend(id as string);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  if (
    !heroImageId &&
    (!fileKeys || typeof fileKeys != "object" || !fileKeys.original)
  ) {
    res.status(400).send({ message: "Invalid filekeys / heroImageId" });
    return;
  }

  return await handleServerExceptions(res, async () => {
    let uid = await firebase.extractUserIdFromRequest({
      request: req,
    });
    const agentPromise: Promise<UserAgentDetails | null> =
      getUserAgentDetails(req);

    const fileKeysProcessor = FileKeysProcessingStrategy.choose(
      id as string,
      uid,
      fileKeys,
      heroImageId
    );

    const finalisedFileKeys: HeroImageFileKeys =
      await fileKeysProcessor.process();

    const blendService = serviceLocator.find(BlendService);
    await blendService.addHeroKeysToBlend(blend.id, finalisedFileKeys);

    let recipeLists = (
      await recoEngineApi.suggestRecipeLists(
        finalisedFileKeys.withoutBg,
        await agentPromise
      )
    ).suggestedRecipeCategories;

    recipeLists.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    );

    if (uid) {
      const recentBlends = await _getRecentBlends(uid);
      let recentRecipes = recentBlends
        .filter(({ metadata }) => {
          return (
            !!metadata.sourceRecipe ||
            (!!metadata.aspectRatio && !!metadata.sourceRecipeId)
          );
        })
        .map(
          ({ metadata }) =>
            metadata.sourceRecipe ?? {
              id: metadata.sourceRecipeId,
              variant: RecipeUtils.aspectRatioToVariant(metadata.aspectRatio),
            }
        );
      recentRecipes = uniqWith(recentRecipes, isEqual);
      if (recentRecipes.length > 0) {
        recipeLists.unshift({
          id: "recents",
          isEnabled: true,
          title: "⏰ Recently Used",
          recipeIds: [],
          recipes: take(recentRecipes, 5),
          sortOrder: 0,
        });
      }
    }

    // For backward compatibility, use recipes to fill 9:16 ones in recipeIds
    recipeLists.forEach((list) => {
      list.recipeIds = list.recipes
        .filter(({ variant }) => variant == "9:16")
        .map(({ id }) => id);
    });

    if (!multipleAspectRatios) {
      // If Multiple Aspect Ratios are not supported, backfill and filter out empty ones

      // For backward compatibility, use recipes to fill 9:16 ones in recipeIds
      recipeLists.forEach((list) => {
        list.recipeIds = list.recipes
          .filter(({ variant }) => variant == "9:16")
          .map(({ id }) => id);
      });

      recipeLists = recipeLists.filter((list) => list.recipeIds.length > 0);
    }

    const randomTemplates = recipeLists
      .map((list) => list.recipeIds)
      .flat()
      .sort(() => 0.5 - Math.random())
      .slice(0, 20);

    return res.send({
      fileKeys: finalisedFileKeys,
      suggestedRecipes: randomTemplates,
      otherRecipes: recipeLists,
    });
  });
};

abstract class FileKeysProcessingStrategy {
  static choose(
    blendId: String,
    userId: String,
    fileKeys?: HeroImageFileKeys,
    heroImageId?: String
  ): FileKeysProcessingStrategy {
    if (heroImageId) {
      return new HeroImageIdBased(heroImageId, blendId, userId);
    }
    return new HeroImageFileKeysBased(fileKeys, blendId, userId);
  }

  abstract process(): Promise<HeroImageFileKeys>;
}

class HeroImageIdBased extends FileKeysProcessingStrategy {
  heroImageId: String;
  blendId: String;
  userId: String;
  constructor(heroImageId: String, blendId: String, userId: String) {
    super();
    this.heroImageId = heroImageId;
    this.blendId = blendId;
    this.userId = userId;
  }

  async process(): Promise<HeroImageFileKeys> {
    const heroImageService = new HeroImageService();

    const heroImage: HeroImage | null = await heroImageService.getImage(
      this.heroImageId as string,
      this.userId as string
    );
    if (!heroImage) {
      throw new UserError("No such hero image for user");
    }
    const blendBucketFilekeys = createBlendBucketFileKeys(
      this.blendId,
      heroImage
    );

    const copyOriginalFile: Promise<any> = copyObject(
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroImage.original,
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      blendBucketFilekeys.original
    );

    const copyBgRemovedFile: Promise<any> = copyObject(
      ConfigProvider.HERO_IMAGES_BUCKET,
      heroImage.withoutBg,
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      blendBucketFilekeys.withoutBg
    );

    await Promise.all([copyOriginalFile, copyBgRemovedFile]);

    await heroImageService.markImageUsage(this.heroImageId);
    return blendBucketFilekeys;
  }
}

class HeroImageFileKeysBased extends FileKeysProcessingStrategy {
  fileKeys: HeroImageFileKeys;
  blendId: String;
  userId: String;
  constructor(fileKeys: HeroImageFileKeys, blendId: String, userId: String) {
    super();
    this.fileKeys = fileKeys;
    this.blendId = blendId;
    this.userId = userId;
  }

  async process(): Promise<HeroImageFileKeys> {
    const heroImageService = new HeroImageService();

    if (this.fileKeys.withoutBg) {
      // noinspection ES6MissingAwait
      heroImageService.createNewImage(this.blendId, this.userId, this.fileKeys);
      return this.fileKeys;
    }

    const { bgRemovedFileKey, fileNameWithExt } = constructBgRemovedFileKey(
      this.fileKeys
    );

    const bgRemovedElementExists = await doesObjectExist(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgRemovedFileKey
    );

    if (!bgRemovedElementExists) {
      let originalImage: Buffer = await getObject(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        this.fileKeys.original
      );
      await createBgRemovedImage(
        originalImage,
        fileNameWithExt,
        this.fileKeys,
        bgRemovedFileKey
      );
    }

    const updatedFilekeys = {
      original: this.fileKeys.original,
      withoutBg: bgRemovedFileKey,
    } as HeroImageFileKeys;

    // noinspection ES6MissingAwait
    heroImageService.createNewImage(this.blendId, this.userId, updatedFilekeys);
    return updatedFilekeys;
  }
}
