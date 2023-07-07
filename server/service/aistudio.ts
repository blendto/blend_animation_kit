import "reflect-metadata";
import DynamoDB from "server/external/dynamodb";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import { IService } from "server/service/index";
import {
  AIBlendPhoto,
  AIBlendPhotoGenerationStatus,
  AIBlendPhotoTopic,
  AiStudioRecentGeneration,
  AIStudioTopicList,
  AIStudioTopicListExternal,
  FeedItem,
  GeneratedImage,
  GeneratedImageMetadata,
  GenerateSamplesRequest,
  Prompt,
  RecentStudioGenerationId,
  SceneConfig,
  SceneConfigOption,
  SceneConfigOptionExternal,
  SceneConfigOptionsExternal,
} from "server/base/models/aistudio";
import { DateTime } from "luxon";
import UserError from "server/base/errors/UserError";
import { BlendHeroImage, ImageFileKeys } from "server/base/models/heroImage";
import AiStudioGeneratorApi, {
  AiStudioGenerateSamplesRequest,
} from "server/internal/aiStudioGeneratorApi";
import { DaxDB } from "server/external/dax";
import ConfigProvider from "server/base/ConfigProvider";
import { fireAndForget } from "server/helpers/async-runner";
import logger from "server/base/Logger";
import { nanoid } from "nanoid";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import { reduceFraction } from "server/helpers/mathUtils";
import AWS from "server/external/aws";

@injectable()
export class AIStudioService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.DaxDB) daxStore: DaxDB;
  @inject(TYPES.BlendService) blendService: BlendService;

  async getAIBlendPhoto(blendId: string): Promise<AIBlendPhoto> {
    return (await this.dataStore.getItem({
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      Key: { blendId },
      ConsistentRead: true,
    })) as AIBlendPhoto;
  }

  async createAIBlendPhoto(
    blendId: string,
    createdBy: string
  ): Promise<AIBlendPhoto> {
    const aiBlendPhoto = await this.getAIBlendPhoto(blendId);
    const heroImages = await this.fetchBlendHero(blendId, createdBy);
    if (aiBlendPhoto) {
      await this.updateHeroInBlendPhoto(blendId, heroImages);
      return this.getAIBlendPhoto(blendId);
    }

    await this.createAIBlendPhotoInternal(blendId, heroImages, createdBy, []);
    return await this.getAIBlendPhoto(blendId);
  }

  async getAIBlendPhotoForUser(
    blendId: string,
    createdBy: string
  ): Promise<AIBlendPhoto> {
    const aiBlendPhoto = (await this.dataStore.getItem({
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      Key: { blendId },
      ConsistentRead: true,
    })) as AIBlendPhoto;
    if (aiBlendPhoto?.createdBy !== createdBy) {
      throw new UserError("No such AI Blend Photo exists");
    }
    return aiBlendPhoto;
  }

  async getTopics({
    languageCode,
    legacyOnly = false,
  }: {
    languageCode: string;
    legacyOnly?: boolean;
  }): Promise<Partial<AIBlendPhotoTopic>[]> {
    const itemList = (
      await this.daxStore.queryItems({
        TableName: ConfigProvider.AI_BLEND_PHOTO_TOPICS_TABLE,
        IndexName: "userId-topicId-index",
        KeyConditionExpression: "userId = :systemUserId",
        ProjectionExpression: "topicId, isPremium, thumbnail, label",
        FilterExpression:
          "isEnabled = :true" +
          (legacyOnly ? " and isLegacyTopic = :true" : ""),
        ExpressionAttributeValues: {
          ":systemUserId": "blend",
          ":true": true,
        },
      })
    ).Items as AIBlendPhotoTopic[];
    return itemList.map((item) => ({
      topicId: item.topicId,
      isPremium: item.isPremium,
      thumbnail: item.thumbnail,
      localisedLabel: item.label[languageCode] ?? item.label.en,
    }));
  }

  async getFeedItems(): Promise<FeedItem[]> {
    const { feedItems } = (await this.daxStore.getItem({
      TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
      Key: { key: "ai_studio_feed", version: "1" },
    })) as {
      feedItems: FeedItem[];
    };
    return feedItems
      .filter((item) => item.isEnabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getAllTopicLists(): Promise<AIStudioTopicList[]> {
    return (
      await this.daxStore.queryItems({
        TableName: ConfigProvider.AI_STUDIO_TOPIC_LISTS_TABLE,
        IndexName: "userId-listId-index",
        KeyConditionExpression: "userId = :systemUserId",
        FilterExpression: "isEnabled = :true",
        ExpressionAttributeValues: {
          ":systemUserId": "blend",
          ":true": true,
        },
      })
    ).Items as AIStudioTopicList[];
  }

  async fetchTopicsWithList(languageCode: string) {
    const topicLists = await this.getAllTopicLists();
    const topics = await this.getTopics({ languageCode });

    const mergedTopicLists = this.mergeTopicsWithList(topicLists, topics);
    return mergedTopicLists
      .map((list) => ({
        ...list,
        localisedLabel: list.label[languageCode] ?? list.label.en,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  mergeTopicsWithList(
    lists: AIStudioTopicList[],
    topics: Partial<AIBlendPhotoTopic>[]
  ): AIStudioTopicListExternal[] {
    return lists.map((list) => ({
      ...list,
      topics: topics.filter((topic) => list.topicIds.includes(topic.topicId)),
    }));
  }

  private async fetchBlendHero(blendId: string, createdBy: string) {
    const blend = await this.blendService.getUserBlend(blendId, createdBy);
    const { heroImages } = blend;
    if (!heroImages) {
      throw new UserError("Blend does not have `heroImages`");
    }
    return heroImages;
  }

  async updatePrompt(
    blendId: string,
    promptText: string
  ): Promise<{ promptId: string }> {
    const aiBlendPhoto = await this.getAIBlendPhoto(blendId);

    const prompts = aiBlendPhoto.prompts ?? [];
    const promptId = nanoid();
    prompts.push({
      id: promptId,
      text: promptText,
    });

    await this.dataStore.updateItem({
      UpdateExpression: "SET #updatedAt = :updatedAt, #prompts = :prompts",
      ExpressionAttributeNames: {
        "#updatedAt": "updatedAt",
        "#prompts": "prompts",
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":prompts": prompts,
      },
      Key: { blendId },
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      ReturnValues: "NONE",
    });

    return { promptId };
  }

  async syncGenerateImage(
    blendId: string,
    generateSamplesRequest: GenerateSamplesRequest,
    createdBy: string
  ): Promise<{
    generatedImage: GeneratedImage;
    activeSampleGenerationRequest: AiStudioGenerateSamplesRequest;
  }> {
    const heroImages = await this.fetchBlendHero(blendId, createdBy);
    const aiBlendPhoto = await this.getAIBlendPhoto(blendId);

    const { prompts, aiStudioRequest } = generateSamplesRequest.updatePrompts(
      blendId,
      aiBlendPhoto?.prompts || [],
      1
    );
    await this.updateBlendPhoto(
      blendId,
      aiBlendPhoto,
      heroImages,
      prompts,
      createdBy
    );
    const generatedImage = (
      await this.requestImageGeneration(aiStudioRequest)
    )[0];
    return {
      generatedImage,
      activeSampleGenerationRequest: aiStudioRequest,
    };
  }

  async requestGenerationSample(
    blendId: string,
    generateSamplesRequest: GenerateSamplesRequest,
    createdBy: string
  ): Promise<{
    aiBlendPhoto: AIBlendPhoto;
    activeSampleGenerationRequest: AiStudioGenerateSamplesRequest;
  }> {
    const heroImages = await this.fetchBlendHero(blendId, createdBy);
    const aiBlendPhoto = await this.getAIBlendPhoto(blendId);

    const { prompts, aiStudioRequest } = generateSamplesRequest.updatePrompts(
      blendId,
      aiBlendPhoto?.prompts || [],
      4
    );
    await this.updateBlendPhoto(
      blendId,
      aiBlendPhoto,
      heroImages,
      prompts,
      createdBy
    );
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fireAndForget(() => this.requestImageGeneration(aiStudioRequest)).catch(
      (err) => {
        logger.error({
          source: "AI_STUDIO_INTERNAL_API",
          error: (err as unknown).toString(),
        });
      }
    );
    const saved = await this.getAIBlendPhotoForUser(blendId, createdBy);
    return {
      aiBlendPhoto: saved,
      activeSampleGenerationRequest: aiStudioRequest,
    };
  }

  private async updateBlendPhoto(
    blendId: string,
    aiBlendPhoto: AIBlendPhoto,
    heroImages: ImageFileKeys,
    prompts: Prompt[],
    createdBy: string
  ) {
    if (aiBlendPhoto) {
      return await this.dataStore.updateItem({
        UpdateExpression:
          "SET #st = :s, #updatedAt = :updatedAt, #prompts = :prompts",
        ExpressionAttributeNames: {
          "#st": "status",
          "#updatedAt": "updatedAt",
          "#prompts": "prompts",
        },
        ExpressionAttributeValues: {
          ":s": AIBlendPhotoGenerationStatus.GENERATING,
          ":updatedAt": Date.now(),
          ":prompts": prompts,
        },
        Key: { blendId },
        TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
        ReturnValues: "NONE",
      });
    }
    await this.createAIBlendPhotoInternal(
      blendId,
      heroImages,
      createdBy,
      prompts
    );
  }

  private async createAIBlendPhotoInternal(
    blendId: string,
    heroImages: ImageFileKeys,
    createdBy: string,
    prompts: Prompt[]
  ) {
    const photo = AIStudioService.createEntity(
      blendId,
      heroImages,
      createdBy,
      prompts
    );

    return await this.dataStore.putItem({
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      Item: photo,
    });
  }

  private static createEntity(
    blendId: string,
    fileKeys: ImageFileKeys,
    createdBy: string,
    prompts: Prompt[]
  ): AIBlendPhoto {
    const currentTime = Date.now();
    const currentDate = DateTime.utc().toISODate();
    return {
      blendId,
      fileKeys,
      generatedImages: [],
      prompts,
      createdAt: currentTime,
      createdOn: currentDate,
      updatedAt: currentTime,
      createdBy,
      status: AIBlendPhotoGenerationStatus.INITIALIZED,
    } as AIBlendPhoto;
  }

  async requestImageGeneration(
    aiStudioRequest: AiStudioGenerateSamplesRequest
  ): Promise<GeneratedImage[]> {
    return await new AiStudioGeneratorApi().generateSamples(aiStudioRequest);
  }

  private async updateHeroInBlendPhoto(
    blendId: string,
    heroImages: BlendHeroImage
  ): Promise<void> {
    await this.dataStore.updateItem({
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      UpdateExpression: "set fileKeys=:fileKeys",
      ExpressionAttributeValues: {
        ":fileKeys": heroImages,
      },
      Key: { blendId },
    });
  }

  async constructPrompt(sceneConfig: SceneConfig): Promise<{ prompt: string }> {
    return await new AiStudioGeneratorApi().generateImagePrompt(sceneConfig);
  }

  async fetchSceneConfigOptions(
    blendId: string,
    languageCode: string
  ): Promise<SceneConfigOptionsExternal> {
    const backgrounds = (
      await this.daxStore.getItem({
        TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
        Key: { key: "scene_creator_backgrounds", version: "1" },
      })
    ).data as SceneConfigOption[];

    const surfaces = (
      await this.daxStore.getItem({
        TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
        Key: { key: "scene_creator_surfaces", version: "1" },
      })
    ).data as SceneConfigOption[];

    const backgroundMapping = this.doMap(backgrounds, languageCode);
    const surfaceMapping = this.doMap(surfaces, languageCode);

    const {
      inferredPerspective: perspective,
      sideViewBackgroundIds,
      sideViewSurfaceIds,
      topViewSurfaceIds,
    } = await new AiStudioGeneratorApi().provideSceneConfig(blendId);

    const sideViewBackgroundList = sideViewBackgroundIds.map((id) =>
      backgroundMapping.get(id)
    );
    const sideViewSurfaceList = sideViewSurfaceIds.map((id) =>
      surfaceMapping.get(id)
    );

    const topViewSurfaceList = topViewSurfaceIds.map((id) =>
      surfaceMapping.get(id)
    );

    return {
      sideViewBackgroundList,
      sideViewSurfaceList,
      topViewSurfaceList,
      perspective,
    };
  }

  private doMap(
    configOptions: SceneConfigOption[],
    languageCode: string
  ): Map<string, SceneConfigOptionExternal> {
    const map: [string, SceneConfigOptionExternal][] = configOptions.map(
      (c) => [
        c.id,
        {
          id: c.id,
          locale: {},
          localisedLabel: (c.locale[languageCode] ?? c.locale.en).text,
        },
      ]
    );
    return new Map<string, SceneConfigOptionExternal>(map);
  }

  async resetAIBlendPhoto(blendId: string, uid: string): Promise<AIBlendPhoto> {
    await this.getAIBlendPhotoForUser(blendId, uid);
    await this.resetBlendPhotoInDB(blendId);
    return await this.getAIBlendPhoto(blendId);
  }

  private async resetBlendPhotoInDB(blendId: string) {
    await this.dataStore.updateItem({
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      UpdateExpression:
        "set #status=:status, #generatedImages=:generatedImages",
      ExpressionAttributeNames: {
        "#status": "status",
        "#generatedImages": "generatedImages",
      },
      ExpressionAttributeValues: {
        ":status": AIBlendPhotoGenerationStatus.INITIALIZED,
        ":generatedImages": [],
      },
      Key: { blendId },
    });
  }

  async fetchRecents(
    uid: string,
    pageKey?: string
  ): Promise<{
    recents: Array<AiStudioRecentGeneration>;
    nextPageKey: string;
  }> {
    const encodedPageKey = new EncodedPageKey(pageKey);
    if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
      throw new UserError("pageKey should be a string");
    }
    const pageKeyObject = encodedPageKey.decode();

    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.AI_STUDIO_RECENTS_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "createdBy-lastUsedAt-idx",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject,
      Limit: 10,
    });

    const nextPageKey = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;

    return {
      recents: data.Items as Array<AiStudioRecentGeneration>,
      nextPageKey,
    };
  }

  async addRecent(
    uid: string,
    blendId: string,
    generatedImageId: string,
    generationMetadata: GeneratedImageMetadata,
    thumbnail: string
  ): Promise<AiStudioRecentGeneration> {
    const dateNow = Date.now();
    const { imageSize } = generationMetadata;
    const aspectRatio = reduceFraction(imageSize[0], imageSize[1]);
    const recentGeneration: AiStudioRecentGeneration = {
      createdBy: uid,
      blendId,
      generatedImageId,
      generationMetadata,
      thumbnail,
      createdAt: dateNow,
      lastUsedAt: dateNow,
      aspectRatio: {
        width: aspectRatio.numerator,
        height: aspectRatio.denominator,
      },
    };

    await this.dataStore.putItem({
      TableName: ConfigProvider.AI_STUDIO_RECENTS_DYNAMODB_TABLE,
      Item: recentGeneration,
    });
    return recentGeneration;
  }

  async markRecentsImageUsage(
    recentsStudioGenerationId: RecentStudioGenerationId
  ): Promise<void> {
    const { generatedImageId, blendId } = recentsStudioGenerationId;
    const params = {
      UpdateExpression: "SET lastUsedAt = :lastUsedAt",
      ExpressionAttributeValues: {
        ":lastUsedAt": Date.now(),
      },
      Key: { generatedImageId, blendId },
      TableName: ConfigProvider.AI_STUDIO_RECENTS_DYNAMODB_TABLE,
    };
    await this.dataStore.updateItem(params);
  }

  async migrateRecents(sourceUid: string, targetUid: string): Promise<void> {
    const recentsIds = await this.getAllRecentsIdsForUser(sourceUid);
    const updates = recentsIds.map(async (recentGenerationId) => {
      await this.changeRecentsOwnership(recentGenerationId, targetUid);
    });
    await Promise.all(updates);
  }

  private async getAllRecentsIdsForUser(
    uid: string
  ): Promise<RecentStudioGenerationId[]> {
    let ids: RecentStudioGenerationId[] = [];
    let nextPageKey: AWS.DynamoDB.Key;
    do {
      const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
        TableName: ConfigProvider.AI_STUDIO_RECENTS_DYNAMODB_TABLE,
        KeyConditionExpression: "#createdBy = :createdBy",
        IndexName: "createdBy-lastUsedAt-idx",
        ExpressionAttributeNames: {
          "#createdBy": "createdBy",
        },
        ExpressionAttributeValues: {
          ":createdBy": uid,
        },
        ProjectionExpression: "blendId, generatedImageId",
        ScanIndexForward: true,
      };
      if (nextPageKey) {
        queryInput.ExclusiveStartKey = nextPageKey;
      }
      const data = await this.dataStore.queryItems(queryInput);
      ids = ids.concat(
        data.Items.map((entry) => entry as RecentStudioGenerationId)
      );
      nextPageKey = data.LastEvaluatedKey;
    } while (nextPageKey);
    return ids;
  }

  private async changeRecentsOwnership(
    recentsStudioGenerationId: RecentStudioGenerationId,
    newUid: string
  ) {
    const { generatedImageId, blendId } = recentsStudioGenerationId;
    await this.dataStore.updateItem({
      UpdateExpression: "SET #updatedAt = :updatedAt, #createdBy = :createdBy",
      ExpressionAttributeNames: {
        "#updatedAt": "updatedAt",
        "#createdBy": "createdBy",
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":createdBy": newUid,
      },
      Key: { generatedImageId, blendId },
      TableName: ConfigProvider.AI_STUDIO_RECENTS_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }
}
