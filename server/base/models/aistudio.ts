import { ImageFileKeys } from "server/base/models/heroImage";
import { Entity } from "server/repositories/base";
import { plainToInstance } from "class-transformer";
import UserError from "server/base/errors/UserError";
import { nanoid } from "nanoid";
import { AiStudioGenerateSamplesRequest } from "server/internal/aiStudioGeneratorApi";

export abstract class GenerateSamplesRequest {
  productSuperCategory: string;

  abstract updatePrompts(
    blendId: string,
    existingPrompts: Prompt[]
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

export class TopicBasedGenerationRequest extends GenerateSamplesRequest {
  topicId: string;

  updatePrompts(
    blendId: string,
    existingPrompts: Prompt[]
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
      },
    };
  }
}

export class PromptBasedGenerationRequest extends GenerateSamplesRequest {
  promptText: string;

  updatePrompts(
    blendId: string,
    existingPrompts: Prompt[]
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
      },
    };
  }
}

export class PromptIdBasedGenerationRequest extends GenerateSamplesRequest {
  promptId: string;

  updatePrompts(
    blendId: string,
    existingPrompts: Prompt[]
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
      },
    };
  }
}

export enum AIBlendPhotoGenerationStatus {
  INITIALIZED = "INITIALIZED",
  GENERATING = "GENERATING",
  GENERATED = "GENERATED",
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

export class AIBlendPhoto implements Entity {
  blendId: string;
  fileKeys: ImageFileKeys;
  prompts: Prompt[];
  generatedImages: GeneratedImages[];
  createdAt: number;
  updatedAt: number;
  createdOn: string;
  createdBy: string;
  status: AIBlendPhotoGenerationStatus;
}

export class GeneratedImages {
  id: string;
  thumbnail: string;
  metadata: Record<string, unknown>;
  promptId?: string;
  topicId: string;
  createdAt: number;
}
