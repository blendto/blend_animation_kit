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
  AIStudioTopicList,
  AIStudioTopicListExternal,
  GenerateSamplesRequest,
  Prompt,
} from "server/base/models/aistudio";
import { DateTime } from "luxon";
import UserError from "server/base/errors/UserError";
import { ImageFileKeys } from "server/base/models/heroImage";
import AiStudioGeneratorApi, {
  AiStudioGenerateSamplesRequest,
} from "server/internal/aiStudioGeneratorApi";
import { DaxDB } from "server/external/dax";
import ConfigProvider from "server/base/ConfigProvider";
import { fireAndForget } from "server/helpers/async-runner";
import logger from "server/base/Logger";

@injectable()
export class AIStudioService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.DaxDB) daxStore: DaxDB;
  @inject(TYPES.BlendService) blendService: BlendService;

  async getAIBlendPhoto(blendId: string): Promise<AIBlendPhoto> {
    return (await this.dataStore.getItem({
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      Key: { blendId },
    })) as AIBlendPhoto;
  }

  async getAIBlendPhotoForUser(
    blendId: string,
    createdBy: string
  ): Promise<AIBlendPhoto> {
    const aiBlendPhoto = (await this.dataStore.getItem({
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      Key: { blendId },
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
    const itemList = (await this.daxStore.scanItems({
      TableName: ConfigProvider.AI_BLEND_PHOTO_TOPICS_TABLE,
      ProjectionExpression: "topicId, isPremium, thumbnail, label",
      FilterExpression:
        "isEnabled = :true" + (legacyOnly ? " and isLegacyTopic = :true" : ""),
      ExpressionAttributeValues: {
        ":true": true,
      },
    })) as AIBlendPhotoTopic[];
    return itemList.map((item) => ({
      topicId: item.topicId,
      isPremium: item.isPremium,
      thumbnail: item.thumbnail,
      localisedLabel: item.label[languageCode] ?? item.label.en,
    }));
  }

  async getAllTopicLists(): Promise<AIStudioTopicList[]> {
    const itemList = (await this.daxStore.scanItems({
      TableName: ConfigProvider.AI_STUDIO_TOPIC_LISTS_TABLE,
      FilterExpression: "isEnabled = :true",
      ExpressionAttributeValues: {
        ":true": true,
      },
    })) as AIStudioTopicList[];
    return itemList;
  }

  async fetchTopicsWithList(languageCode: string) {
    const topicLists = await this.getAllTopicLists();
    const topics = await this.getTopics({ languageCode });

    const mergedTopicLists = this.mergeTopicsWithList(topicLists, topics);
    return mergedTopicLists.map((list) => ({
      ...list,
      localisedLabel: list.label[languageCode] ?? list.label.en,
    }));
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

  async requestGenerationSample(
    blendId: string,
    generateSamplesRequest: GenerateSamplesRequest,
    createdBy: string
  ): Promise<{
    aiBlendPhoto: AIBlendPhoto;
    activeSampleGenerationRequest: AiStudioGenerateSamplesRequest;
  }> {
    const blend = await this.blendService.getUserBlend(blendId, createdBy);
    const { heroImages } = blend;
    if (!heroImages) {
      throw new UserError("Blend does not have `heroImages`");
    }

    const aiBlendPhoto = await this.getAIBlendPhoto(blendId);
    const { prompts, aiStudioRequest } = generateSamplesRequest.updatePrompts(
      blendId,
      aiBlendPhoto?.prompts || []
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
  ) {
    await new AiStudioGeneratorApi().generateSamples(aiStudioRequest);
  }
}
