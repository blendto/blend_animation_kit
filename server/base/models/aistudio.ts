import { ImageFileKeys } from "server/base/models/heroImage";
import { plainToInstance } from "class-transformer";
import UserError from "server/base/errors/UserError";
import { nanoid } from "nanoid";
import { AiStudioGenerateSamplesRequest } from "server/internal/aiStudioGeneratorApi";
import { Rect, Size } from "server/base/models/recipe";

export const AspectRatioToSizes: Record<string, Size> = {
  "1:1": { width: 512, height: 512 },
  "9:16": { width: 432, height: 768 },
  "16:9": { width: 768, height: 432 },
  "3:4": { width: 576, height: 768 },
  "4:3": { width: 768, height: 576 },
  "2:3": { width: 512, height: 768 },
  "3:2": { width: 768, height: 512 },
  "4:5": { width: 512, height: 640 },
};

export abstract class GenerateSamplesRequest {
  productSuperCategory: string;
  requestIndex?: number;
  aspect?: Size;
  heroRect?: Rect;
  sourceGeneratedImageId?: string;

  abstract updatePrompts(
    blendId: string,
    existingPrompts: Prompt[],
    countOfImagesToGenerate: number
  ): {
    prompts: Prompt[];
    aiStudioRequest: AiStudioGenerateSamplesRequest;
  };

  static deserialize(obj: Record<string, unknown>): GenerateSamplesRequest {
    const { $ } = obj;
    if ($ === "TopicBasedGenerationRequest") {
      return plainToInstance(TopicBasedGenerationRequest, obj, {
        enableImplicitConversion: true,
      });
    }
    if ($ === "PromptBasedGenerationRequest") {
      return plainToInstance(PromptBasedGenerationRequest, obj, {
        enableImplicitConversion: true,
      });
    }
    if ($ === "PromptIdBasedGenerationRequest") {
      return plainToInstance(PromptIdBasedGenerationRequest, obj, {
        enableImplicitConversion: true,
      });
    }
    if ($ === "MetadataBasedGenerationRequest") {
      return plainToInstance(MetadataBasedGenerationRequest, obj, {
        enableImplicitConversion: true,
      });
    }
    throw Error(`Invalid value: ${$} in attribute '$'`);
  }
}

function convertAspectToResolution(aspect?: Size): [number, number] | null {
  if (!aspect) return null;
  const aspectString = `${aspect.width}:${aspect.height}`;
  const size = AspectRatioToSizes[aspectString];
  if (size) return [size.width, size.height];
  throw new UserError("Invalid aspect");
}

function heroToRPosition(
  rect?: Rect,
  aspect?: Size
): [number, number, number, number] {
  const size = convertAspectToResolution(aspect);
  if (!size) return null;
  if (!rect) return null;
  const [width, height] = size;
  return [
    rect.left * width,
    rect.top * height,
    (rect.left + rect.width) * width,
    (rect.top + rect.height) * height,
  ];
}

export class TopicBasedGenerationRequest extends GenerateSamplesRequest {
  topicId: string;

  updatePrompts(
    blendId: string,
    existingPrompts: Prompt[],
    countOfImagesToGenerate: number
  ): {
    prompts: Prompt[];
    aiStudioRequest: AiStudioGenerateSamplesRequest;
  } {
    return {
      prompts: existingPrompts,
      aiStudioRequest: {
        blendId,
        productSuperCategory: this.productSuperCategory,
        topicId: this.topicId,
        imagesToGenerate: countOfImagesToGenerate,
        requestIndex: this.requestIndex,
        parameters: {
          canvas: convertAspectToResolution(this.aspect),
          position: heroToRPosition(this.heroRect, this.aspect),
        },
        sourceGeneratedImageId: this.sourceGeneratedImageId,
      },
    };
  }
}

export class PromptBasedGenerationRequest extends GenerateSamplesRequest {
  promptText: string;

  updatePrompts(
    blendId: string,
    existingPrompts: Prompt[],
    countOfImagesToGenerate: number
  ): {
    prompts: Prompt[];
    aiStudioRequest: AiStudioGenerateSamplesRequest;
  } {
    const promptId = nanoid();
    const prompts = [
      ...existingPrompts,
      {
        id: promptId,
        text: this.promptText,
      },
    ];
    return {
      prompts,
      aiStudioRequest: {
        blendId,
        productSuperCategory: this.productSuperCategory,
        promptId,
        imagesToGenerate: countOfImagesToGenerate,
        requestIndex: this.requestIndex,
        parameters: {
          canvas: convertAspectToResolution(this.aspect),
          position: heroToRPosition(this.heroRect, this.aspect),
        },
        sourceGeneratedImageId: this.sourceGeneratedImageId,
      },
    };
  }
}

export class PromptIdBasedGenerationRequest extends GenerateSamplesRequest {
  promptId: string;

  updatePrompts(
    blendId: string,
    existingPrompts: Prompt[],
    countOfImagesToGenerate: number
  ): {
    prompts: Prompt[];
    aiStudioRequest: AiStudioGenerateSamplesRequest;
  } {
    const validPromptId = existingPrompts.some(
      (prompt) => prompt.id === this.promptId
    );
    if (!validPromptId) {
      throw new UserError("Invalid promptId");
    }
    return {
      prompts: existingPrompts,
      aiStudioRequest: {
        blendId,
        productSuperCategory: this.productSuperCategory,
        promptId: this.promptId,
        imagesToGenerate: countOfImagesToGenerate,
        requestIndex: this.requestIndex,
        parameters: {
          canvas: convertAspectToResolution(this.aspect),
          position: heroToRPosition(this.heroRect, this.aspect),
        },
        sourceGeneratedImageId: this.sourceGeneratedImageId,
      },
    };
  }
}

export interface RecentStudioGenerationId {
  blendId: string;
  generatedImageId: string;
}
export class MetadataBasedGenerationRequest extends GenerateSamplesRequest {
  generationMetadata: Record<string, unknown>;
  recentsStudioGenerationId?: RecentStudioGenerationId;

  updatePrompts(
    blendId: string,
    existingPrompts: Prompt[],
    countOfImagesToGenerate: number
  ): {
    prompts: Prompt[];
    aiStudioRequest: AiStudioGenerateSamplesRequest;
  } {
    return {
      prompts: existingPrompts,
      aiStudioRequest: {
        blendId,
        productSuperCategory: this.productSuperCategory,
        imagesToGenerate: countOfImagesToGenerate,
        requestIndex: this.requestIndex,
        parameters: {
          canvas: convertAspectToResolution(this.aspect),
          position: heroToRPosition(this.heroRect, this.aspect),
        },
        sourceGeneratedImageId: this.sourceGeneratedImageId,
        generationMetadata: this.generationMetadata,
      },
    };
  }
}

export enum AIBlendPhotoGenerationStatus {
  INITIALIZED = "INITIALIZED",
  GENERATING = "GENERATING",
  GENERATED = "GENERATED",
  FAILED = "FAILED",
}

export class Prompt {
  id: string;
  text: string;
}

export class SceneConfigOptionsExternal {
  sideViewBackgroundList: SceneConfigOptionExternal[];
  sideViewSurfaceList: SceneConfigOptionExternal[];
  topViewSurfaceList: SceneConfigOptionExternal[];
  perspective: ScenePerspective;
}

export class SceneConfigOption {
  id: string;
  locale: Record<string, Locale>;
}

export class Locale {
  text: string;
}

export class SceneConfigOptionExternal extends SceneConfigOption {
  localisedLabel: string;
}

export class AIBlendPhotoTopic {
  topicId: string;
  isPremium: boolean;
  thumbnail: string;
  label: Record<string, string>;
  localisedLabel?: string;
}

export class AIStudioTopicList {
  id: string;
  isEnabled: boolean;
  label: Record<string, string>;
  topicIds: string[];
  sortOrder: number;
  hideLabel: boolean;
}

export class AIStudioTopicListExternal extends AIStudioTopicList {
  localisedLabel?: string;
  topics: Partial<AIBlendPhotoTopic>[];
}

export class AIBlendPhoto {
  blendId: string;
  fileKeys: ImageFileKeys;
  prompts: Prompt[];
  createdAt: number;
  updatedAt: number;
  createdOn: string;
  createdBy: string;
  status: AIBlendPhotoGenerationStatus;
}

export class AIBlendPhotoExtended extends AIBlendPhoto {
  generatedImages: GeneratedImage[];
}

export class GeneratedImage {
  id: string;
  blendId: string;
  thumbnail: string;
  image: string;
  metadata: GeneratedImageMetadata;
  promptId?: string;
  topicId: string;
  createdAt: number;
}

export interface GeneratedImageMetadata extends Record<string, unknown> {
  imageSize: [number, number];
}

export enum ScenePerspective {
  SIDE_VIEW = "side_view",
  TOP_VIEW = "top_view",
}

export class SceneConfig {
  perspective: ScenePerspective;
  surface: string;
  background: string;
}

export class FeedItem {
  id: string;
  thumbnail: string;
  metadata: Record<string, unknown>;
  aspectRatio: Size;
  isEnabled: boolean;
  sortOrder: number;
}

export class AiStudioRecentGeneration {
  generatedImageId: string;
  generationMetadata: GeneratedImageMetadata;
  blendId: string;
  thumbnail: string;
  createdBy: string;
  createdAt: number;
  lastUsedAt: number;
  aspectRatio: Size;
}
