import { ImageFileKeys } from "server/base/models/heroImage";
import { Entity } from "server/repositories/base";
import { plainToInstance } from "class-transformer";
import UserError from "server/base/errors/UserError";
import { nanoid } from "nanoid";
import { AiStudioGenerateSamplesRequest } from "server/internal/aiStudioGeneratorApi";
import { Size } from "server/base/models/recipe";

export abstract class GenerateSamplesRequest {
  productSuperCategory: string;
  requestIndex?: number;
  aspect?: Size;

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
    throw Error(`Invalid value: ${$} in attribute '$'`);
  }
}

function convertAspectToResolution(aspect?: Size): [number, number] {
  if (!aspect) return null;
  const aspectString = `${aspect.width}:${aspect.height}`;
  if (aspectString === "1:1") return [512, 512];
  if (aspectString === "9:16") return [432, 768];
  if (aspectString === "16:9") return [768, 432];
  if (aspectString === "3:4") return [576, 768];
  if (aspectString === "4:3") return [768, 576];
  if (aspectString === "3:2") return [768, 512];
  if (aspectString === "2:3") return [512, 768];
  if (aspectString === "4:5") return [512, 640];
  throw new UserError("Invalid aspect");
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
        },
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
        },
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
        },
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

export class AIBlendPhoto implements Entity {
  blendId: string;
  fileKeys: ImageFileKeys;
  prompts: Prompt[];
  generatedImages: GeneratedImage[];
  createdAt: number;
  updatedAt: number;
  createdOn: string;
  createdBy: string;
  status: AIBlendPhotoGenerationStatus;
}

export class GeneratedImage {
  id: string;
  thumbnail: string;
  metadata: Record<string, unknown>;
  promptId?: string;
  topicId: string;
  createdAt: number;
}
