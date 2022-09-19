import "reflect-metadata";
import { nanoid } from "nanoid";
import { DateTime } from "luxon";

import { HeroImageFileKeys } from "server/base/models/heroImage";
import DynamoDB from "server/external/dynamodb";
import {
  BatchLevelEditStatus,
  Blend,
  BlendStatus,
  BlendVersion,
  MinimalBlend,
} from "server/base/models/blend";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import UserError from "server/base/errors/UserError";
import { ImageMetadata, Recipe, RecipeUtils } from "server/base/models/recipe";
import { adjustSizeToFit } from "server/helpers/imageUtils";
import {
  copyObject,
  deleteMultipleObjects,
  listObjectsInFolder,
} from "server/external/s3";
import { IService } from "server/service";
import FileKeysService from "server/service/fileKeys";
import take from "lodash/take";
import uniqWith from "lodash/uniqWith";
import {
  recipeIdStr,
  RecipeList,
  RecipeVariantId,
} from "server/base/models/recipeList";
import { DaxDB } from "server/external/dax";

// Resolution to use when output object is not populated
// When aspect ratio used to be fixed, these were the constant ones.
const FALLBACK_OUTPUT_RESOLUTION = { width: 720, height: 1280 };
const FALLBACK_OUTPUT_THUMBNAIL_RESOLUTION = { width: 628, height: 1200 };
type BlendsPage = { blends: Blend[]; nextPageKey: string };
const PAGE_SIZE = 15;

type RecipeVariantHeroCheckMap = Record<string, boolean>;

@injectable()
export class BlendService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.DaxDB) daxStore: DaxDB;
  @inject(TYPES.FileKeysService) fileKeysService: FileKeysService;

  async getBlendIdsForBatch(batchId: string): Promise<string[]> {
    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      KeyConditionExpression: "#batchId = :batchId",
      FilterExpression: "#status <> :status",
      IndexName: "batchId-blendId-index",
      ExpressionAttributeNames: {
        "#batchId": "batchId",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":batchId": batchId,
        ":status": BlendStatus.Deleted,
      },
      ProjectionExpression: "id",
      ScanIndexForward: false,
    });
    return data.Items.map((entry) => entry.id as string);
  }

  async addOrUpdateImageFileKeys(
    blend: Blend,
    fileKeyItem: HeroImageFileKeys,
    options = { isHeroImage: false as boolean }
  ) {
    const newFileKeys = this.fileKeysService.constructUpdatedFileKeysFromBlend(
      blend,
      fileKeyItem
    );

    let updateQuery =
      "SET updatedAt = :updatedAt, imageFileKeys = :imageFileKeys";
    const expressionAttributes = {
      ":updatedAt": Date.now(),
      ":imageFileKeys": newFileKeys,
    };
    if (
      options.isHeroImage ||
      blend.heroImages.original === fileKeyItem.original
    ) {
      updateQuery = `${updateQuery}, heroImages = :heroImages`;
      expressionAttributes[":heroImages"] = fileKeyItem;
      blend.heroImages = fileKeyItem;
    }

    await this.dataStore.updateItem({
      UpdateExpression: updateQuery,
      ExpressionAttributeValues: expressionAttributes,
      Key: { id: blend.id },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async getBlendIdsForUser(uid: string): Promise<string[]> {
    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "createdBy-updatedAt-idx",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
      },
      ProjectionExpression: "id",
      ScanIndexForward: true,
    });
    return data.Items.map((entry) => entry.id as string);
  }

  async getBlend(
    id: string,
    version: BlendVersion = BlendVersion.current,
    consistentRead = false
  ): Promise<Blend> {
    let blend;

    if (!consistentRead) {
      blend = await this.dataStore.getItem({
        TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
        Key: { id, version },
      });
    }

    if (!blend) {
      // TODO: Remove this post migration. This is a HACK to fix consistency issues.
      blend = await this.dataStore.getItem({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        Key: {
          id,
        },
        ConsistentRead: consistentRead,
      });
    }

    if (!blend) {
      return null;
    }

    return this.backfillBlendOutput(<Blend>blend);
  }

  async getMinimalBlends(blendIds: string[]): Promise<MinimalBlend[]> {
    const Keys = blendIds.map((id) => ({ id }));
    if (Keys.length === 0) {
      return [];
    }
    const AttributesToGet = [
      "id",
      "filePath",
      "imagePath",
      "thumbnail",
      "output",
      "createdAt",
      "updatedAt",
      "status",
    ];
    const responseMap = await this.dataStore.batchGetItems({
      RequestItems: {
        [ConfigProvider.BLEND_DYNAMODB_TABLE]: { Keys, AttributesToGet },
      },
    });
    return responseMap[ConfigProvider.BLEND_DYNAMODB_TABLE] as MinimalBlend[];
  }

  async initBlend(
    uid: string,
    options?: { batchId: string; heroFileName?: string }
  ): Promise<Blend> {
    let blendRequestId: string;
    do {
      blendRequestId = nanoid(8);
      /* eslint-disable no-await-in-loop */
      const item = await this.dataStore.getItem({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        Key: {
          id: blendRequestId,
        },
      });
      if (!item) {
        break;
      }
    } while (true);

    let fileKey = null;
    if (options?.heroFileName) {
      fileKey = `${blendRequestId}/${options.heroFileName}`;
    }

    return await this.addBlendToDB(blendRequestId, uid, {
      batchId: options?.batchId,
      heroImages: {
        original: fileKey as string,
      },
    });
  }

  async addBlendToDB(
    id: string,
    userId?: string,
    options?: { batchId: string; heroImages: HeroImageFileKeys }
  ): Promise<Blend> {
    const currentTime = Date.now();
    const currentDate = DateTime.utc().toISODate();

    const blend: Blend = {
      id,
      version: BlendVersion.current,
      batchId: options?.batchId,
      status: BlendStatus.Initialized,
      statusUpdates: [
        {
          status: BlendStatus.Initialized,
          on: currentTime,
        },
      ],
      expireAt: DateTime.local()
        .plus({ days: 1 })
        .startOf("second")
        .toSeconds(),
      createdAt: currentTime,
      createdOn: currentDate,
      updatedAt: currentTime,
      updatedOn: currentDate,
      heroImages: options?.heroImages,
      ...(userId !== null && { createdBy: userId }),
    };

    await this.dataStore.putItem({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      Item: blend,
    });
    return blend;
  }

  backfillBlendOutput(item: Blend) {
    const { filePath, imagePath, thumbnail, status } = item;
    let { output } = item;

    if (!output && status === BlendStatus.Generated) {
      output = {
        video: {
          path: filePath,
          resolution: FALLBACK_OUTPUT_RESOLUTION,
        },
        image: {
          path: imagePath,
          resolution: FALLBACK_OUTPUT_RESOLUTION,
        },
        thumbnail: {
          path: thumbnail,
          resolution: FALLBACK_OUTPUT_THUMBNAIL_RESOLUTION,
        },
      };
    }

    return {
      ...item,
      filePath: output?.video.path ?? null,
      imagePath: output?.image.path ?? null,
      thumbnail: output?.thumbnail.path ?? null,
      output: output ?? null,
    };
  }

  async clearExpiry(blendIds: string[]) {
    const clearOne = (blendId: string): Promise<unknown> =>
      this.dataStore.updateItem({
        UpdateExpression: "REMOVE expireAt",
        Key: { id: blendId },
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        ReturnValues: "NONE",
      });

    await Promise.all(blendIds.map(clearOne));
  }

  private async heroCheckMapForRecipes(
    recipesIds: RecipeVariantId[]
  ): Promise<RecipeVariantHeroCheckMap> {
    recipesIds = uniqWith(
      recipesIds,
      (value: RecipeVariantId, other: RecipeVariantId) =>
        value.id === other.id && value.variant === other.variant
    );
    const Keys = recipesIds.map(({ id, variant }) => ({ id, variant }));
    const AttributesToGet = ["id", "recipeDetails", "variant"];

    const responseMap = await this.daxStore.batchGetItems({
      RequestItems: {
        [ConfigProvider.RECIPE_DYNAMODB_TABLE]: { Keys, AttributesToGet },
      },
    });
    const recipes = responseMap[
      ConfigProvider.RECIPE_DYNAMODB_TABLE
    ] as Recipe[];

    const idVariantToHeroMap: RecipeVariantHeroCheckMap = {};
    recipes.forEach((recipe) => {
      idVariantToHeroMap[recipeIdStr(recipe)] =
        !!recipe.recipeDetails.elements.hero;
    });
    return idVariantToHeroMap;
  }

  async addRecentsToRecipeLists(
    uid: string,
    recipeLists: RecipeList[]
  ): Promise<RecipeList[]> {
    const recentBlends = await this.getRecentBlends(uid);
    let recentRecipes = recentBlends
      .filter(
        ({ metadata }) =>
          !!metadata.sourceRecipe ||
          (!!metadata.aspectRatio && !!metadata.sourceRecipeId)
      )
      .map(
        ({ metadata }) =>
          metadata.sourceRecipe ?? {
            id: metadata.sourceRecipeId,
            variant: RecipeUtils.aspectRatioToVariant(metadata.aspectRatio),
          }
      );
    const heroCheckMap = await this.heroCheckMapForRecipes(recentRecipes);
    recentRecipes = recentRecipes.filter((r) => heroCheckMap[recipeIdStr(r)]);

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
    return recipeLists;
  }

  async getRecentBlends(uid: string) {
    return <Blend[]>(
      await this.dataStore.queryItems({
        TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
        KeyConditionExpression: "#createdBy = :createdBy",
        IndexName: "created-by-idx",
        ExpressionAttributeNames: {
          "#createdBy": "createdBy",
          "#status": "status",
          "#version": "version",
          "#metadata": "metadata",
        },
        ExpressionAttributeValues: {
          ":createdBy": uid,
          ":generatedStatus": "GENERATED",
          ":generatedVersion": "GENERATED",
        },
        ProjectionExpression: "id, metadata",
        FilterExpression:
          "#version = :generatedVersion AND #status = :generatedStatus AND attribute_exists(#metadata)",
        ScanIndexForward: false,
        Limit: 20,
      })
    ).Items;
  }

  // TODO: Explore possibilities to reuse this inside submitBlend() in blend/[id].ts
  async updateBlend(blend: Blend): Promise<Blend> {
    const {
      images,
      externalImages,
      gifsOrStickers,
      texts,
      buttons,
      links,
      interactions,
      metadata,
      isWatermarked,
    } = blend;

    const now = Date.now();
    const updatedOn = DateTime.utc().toISODate();
    const params = {
      UpdateExpression:
        "SET #st = :s, statusUpdates = list_append(statusUpdates, :update), title = :title," +
        "interactions = :inter, images = :images, externalImages = :externalImages, audios = :audios," +
        "slides = :slides, cameraClips = :clips, gifsOrStickers = :gifsOrStickers, texts = :texts, buttons = :buttons, links = :links," +
        "metadata = :metadata, updatedAt = :updatedAt, updatedOn = :updatedOn, #batchSt = :batchSt, #isWatermarked = :isWatermarked REMOVE expireAt",
      ExpressionAttributeNames: {
        "#st": "status",
        "#batchSt": "batchLevelEditStatus",
        "#isWatermarked": "isWatermarked",
      },
      ExpressionAttributeValues: {
        ":s": "SUBMITTED",
        ":update": [{ status: "SUBMITTED", on: now }],
        ":title": null,
        ":inter": interactions,
        ":images": images,
        ":externalImages": externalImages,
        ":audios": null,
        ":slides": null,
        ":clips": null,
        ":gifsOrStickers": gifsOrStickers,
        ":texts": texts,
        ":buttons": buttons || [],
        ":links": links || [],
        ":metadata": metadata,
        ":updatedAt": now,
        ":updatedOn": updatedOn,
        ":batchSt": BatchLevelEditStatus.INDIVIDUALLY_EDITED,
        ":isWatermarked": isWatermarked ?? false,
      },
      Key: { id: blend.id },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "ALL_NEW",
    };

    const dbUpdateResponse = await this.dataStore.updateItem(params);
    return dbUpdateResponse.Attributes as Blend;
  }

  async reInitialise(blendId: string): Promise<void> {
    const now = Date.now();
    const updatedOn = DateTime.utc().toISODate();
    await this.dataStore.updateItem({
      UpdateExpression:
        "SET #st = :s, updatedAt = :updatedAt, updatedOn = :updatedOn",
      ExpressionAttributeNames: {
        "#st": "batchLevelEditStatus",
      },
      ExpressionAttributeValues: {
        ":s": BatchLevelEditStatus.RECIPE_EDITED,
        ":updatedAt": now,
        ":updatedOn": updatedOn,
      },
      Key: { id: blendId },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async getUserBlends(
    uid: string,
    pageKey: string
  ): Promise<{ data: Blend[]; nextPageKey: string }> {
    const pageItems = { data: [], nextPageKey: pageKey };
    let fetched: BlendsPage;
    do {
      fetched = await this.getBlendPage(uid, pageItems.nextPageKey);
      pageItems.data.push(...fetched.blends);
      pageItems.nextPageKey = fetched.nextPageKey;
    } while (pageItems.data.length < PAGE_SIZE && fetched.nextPageKey);

    return pageItems;
  }

  async deleteBlend(blendId: string) {
    await this.dataStore.updateItem({
      UpdateExpression: `SET #status = :status, updatedAt = :updatedAt`,
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":status": BlendStatus.Deleted,
      },
      Key: { id: blendId },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async getAllUserBlends(uid: string): Promise<Partial<Blend>[]> {
    let blends: Partial<Blend>[] = [];
    let pageKeyObject: Record<string, unknown>;
    do {
      // eslint-disable-next-line no-await-in-loop
      const data = await this.dataStore.queryItems({
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        KeyConditionExpression: "#createdBy = :createdBy",
        IndexName: "createdBy-updatedAt-idx",
        ExpressionAttributeNames: {
          "#createdBy": "createdBy",
        },
        ExpressionAttributeValues: {
          ":createdBy": uid,
        },
        ProjectionExpression: "id",
        ExclusiveStartKey: pageKeyObject,
      });
      blends = blends.concat(data.Items);
      pageKeyObject = data.LastEvaluatedKey;
    } while (pageKeyObject);

    return blends;
  }

  async cleanupUserBlends(uid: string): Promise<void> {
    const blends = await this.getAllUserBlends(uid);
    const deleteS3ObjectsPromises: Promise<void>[] = blends.map(
      (b) =>
        new Promise((resolve, reject) => {
          listObjectsInFolder(ConfigProvider.BLEND_INGREDIENTS_BUCKET, b.id)
            .then((ingredientObjects) => {
              if (ingredientObjects.length) {
                return deleteMultipleObjects(
                  ConfigProvider.BLEND_INGREDIENTS_BUCKET,
                  ingredientObjects.map((o) => o.Key)
                );
              }
            })
            .then(() =>
              listObjectsInFolder(ConfigProvider.BLEND_OUTPUT_BUCKET, b.id)
            )
            .then((outputObjects) => {
              if (outputObjects.length) {
                return deleteMultipleObjects(
                  ConfigProvider.BLEND_OUTPUT_BUCKET,
                  outputObjects.map((o) => o.Key)
                );
              }
            })
            .then(() => resolve())
            .catch((err) => reject(err));
        })
    );
    await Promise.all(deleteS3ObjectsPromises);
    await this.dataStore.batchDeleteItems(
      ConfigProvider.BLEND_DYNAMODB_TABLE,
      blends
    );
  }

  async copyRecipeToBlend(
    blendId: string,
    heroImages: HeroImageFileKeys,
    recipe: Recipe,
    isWatermarked?: boolean
  ): Promise<Blend> {
    const copyFilePromises = [];
    let interactionUpdatePromise;

    const blendImages = recipe.images.map((image) => {
      if (image.uid === recipe.recipeDetails.elements.hero?.uid) {
        const interaction = recipe.interactions.find(
          // eslint-disable-next-line eqeqeq
          (_) => _.assetType == "IMAGE" && _.assetUid == image.uid
        );
        // Starting from 2.5, we only show the cropped area in the mobile_app
        // instead of actually cropping the image and uploading it.
        // The hero image should not have cropRect property in a recipe as it
        // will get replaced.
        (interaction.metadata as ImageMetadata).cropRect = null;
        if ((interaction.metadata as ImageMetadata).hasBgRemoved) {
          interactionUpdatePromise = adjustSizeToFit(
            interaction,
            heroImages.withoutBg
          );
          return { ...image, uri: heroImages.withoutBg };
        }
        interactionUpdatePromise = adjustSizeToFit(
          interaction,
          heroImages.original
        );
        return { ...image, uri: heroImages.original };
      }
      const uriParts = image.uri.split("/");
      uriParts[0] = blendId;
      const targetUri = uriParts.join("/");
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

    const modifiedBlend = {
      ...recipe,
      metadata: {
        ...recipe.metadata,
        sourceRecipeId: recipe.id,
        sourceRecipe: { id: recipe.id, variant: recipe.variant },
      },
      id: blendId,
      images: blendImages,
      isWatermarked: isWatermarked || false,
    } as Blend;

    return await this.updateBlend(modifiedBlend);
  }

  private async getBlendPage(
    uid: string,
    pageKey?: string
  ): Promise<BlendsPage> {
    const encodedPageKey = new EncodedPageKey(pageKey);
    if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
      throw new UserError("pageKey should be a string");
    }
    const pageKeyObject = encodedPageKey.decode();

    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "createdBy-updatedAt-idx",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
        "#status": "status",
        "#output": "output",
        "#version": "version",
        "#batchId": "batchId",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
        ":generated": "GENERATED",
        ":submitted": "SUBMITTED",
        ":currentVersion": "CURRENT",
      },
      ProjectionExpression:
        "id, filePath, imagePath, thumbnail, #output, createdAt, updatedAt, #status",
      FilterExpression:
        "(#version = :currentVersion) AND (#status = :generated OR #status = :submitted) AND attribute_not_exists(#batchId)",
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject as Record<string, unknown>,
      Limit: PAGE_SIZE,
    });

    const blends = data.Items.map((item) =>
      this.backfillBlendOutput(<Blend>item)
    );
    const nextPageKey = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;

    return { blends, nextPageKey };
  }
}
