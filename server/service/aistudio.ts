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
import { fireAndForget } from "server/helpers/async-runner";

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
    const aiBlendPhoto = (await this.dataStore.getItem({
      TableName: ConfigProvider.AI_BLEND_PHOTOS_TABLE,
      Key: { blendId },
    })) as AIBlendPhoto;
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
  ): Promise<{
    aiBlendPhoto: AIBlendPhoto;
    activeSampleGenerationRequest: AiStudioGenerateSamplesRequest;
  }> {
    const blend = await this.blendService.getUserBlend(blendId, createdBy);
    const { heroImages } = blend;
    if (!heroImages) {
      throw new UserError("Blend does not have `heroImages`");
    }

    const aiBlendPhoto = await this.repo.get({ blendId });
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
    fireAndForget(() => this.requestImageGeneration(aiStudioRequest)).then();
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
      const update = AIStudioService.updateEntity(prompts);
      return await this.repo.updatePartial({ blendId }, update);
    }
    const update = AIStudioService.createEntity(heroImages, createdBy, prompts);
    return await this.repo.updatePartial({ blendId }, update);
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
      updatedAt: currentTime,
      createdBy,
      status: AIBlendPhotoGenerationStatus.INITIALIZED,
    } as AIBlendPhoto;
  }

  private static updateEntity(prompts: Prompt[]): AIBlendPhoto {
    return {
      generatedImages: [],
      prompts,
      updatedAt: Date.now(),
      status: AIBlendPhotoGenerationStatus.GENERATING,
    } as AIBlendPhoto;
  }

  async requestImageGeneration(
    aiStudioRequest: AiStudioGenerateSamplesRequest
  ) {
    await new AiStudioGeneratorApi().generateSamples(aiStudioRequest);
  }
}
