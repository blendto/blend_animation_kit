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
  GenerateSamplesRequest,
  Prompt,
} from "server/base/models/aistudio";
import { DateTime } from "luxon";
import { Repo } from "server/repositories/base";
import UserError from "server/base/errors/UserError";
import { ImageFileKeys } from "server/base/models/heroImage";
import AiStudioGeneratorApi, {
  AiStudioGenerateSamplesRequest,
} from "server/internal/aiStudioGeneratorApi";
import { DaxDB } from "server/external/dax";
import ConfigProvider from "server/base/ConfigProvider";

@injectable()
export class AIStudioService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.DaxDB) daxStore: DaxDB;
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.AIBlendPhotoRepo) repo: Repo<AIBlendPhoto>;

  async getAIBlendPhotoForUser(
    blendId: string,
    createdBy: string
  ): Promise<AIBlendPhoto> {
    const aiBlendPhoto = await this.repo.get({ blendId });
    if (aiBlendPhoto?.createdBy !== createdBy) {
      throw new UserError("No such AI Blend Photo exists");
    }
    return aiBlendPhoto;
  }

  async getTopics(languageCode: string): Promise<Partial<AIBlendPhotoTopic>[]> {
    const itemList = (await this.daxStore.scanItems({
      TableName: ConfigProvider.AI_BLEND_PHOTO_TOPICS_TABLE,
      ProjectionExpression: "topicId, isPremium, thumbnail, label",
    })) as AIBlendPhotoTopic[];
    return itemList.map((item) => ({
      topicId: item.topicId,
      isPremium: item.isPremium,
      thumbnail: item.thumbnail,
      localisedLabel: item.label[languageCode] ?? item.label.en,
    }));
  }

  async requestGenerationSample(
    blendId: string,
    generateSamplesRequest: GenerateSamplesRequest,
    createdBy: string
  ): Promise<AIBlendPhoto> {
    const blend = await this.blendService.getUserBlend(blendId, createdBy);
    if (!blend.heroImages) {
      throw new UserError("Blend does not have `heroImages`");
    }
    const aiBlendPhoto = await this.repo.get({ blendId });
    const { prompts, aiStudioRequest } = generateSamplesRequest.updatePrompts(
      blendId,
      aiBlendPhoto.prompts || []
    );

    const update = AIStudioService.createEntity(
      blend.heroImages,
      createdBy,
      prompts
    );
    const saved = await this.repo.updatePartial({ blendId }, update);
    await this.requestImageGeneration(aiStudioRequest);
    return saved;
  }

  private static createEntity(
    fileKeys: ImageFileKeys,
    createdBy: string,
    prompts: Prompt[]
  ): AIBlendPhoto {
    const currentTime = Date.now();
    const currentDate = DateTime.utc().toISODate();
    return {
      fileKeys,
      generatedImages: [],
      prompts,
      createdAt: currentTime,
      createdOn: currentDate,
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
