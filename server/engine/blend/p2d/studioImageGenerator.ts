import { sample } from "lodash";
import ConfigProvider from "server/base/ConfigProvider";
import {
  AspectRatioToSizes,
  GenerateSamplesRequest,
} from "server/base/models/aistudio";
import { Blend } from "server/base/models/blend";
import { AIStudioService } from "server/service/aistudio";

interface ImageGenerationOptions {
  promptText: string | null;
  aspectRatio: { width: number; height: number };
  blend: Blend;
  uid: string;
}

export class StudioImageGenerator {
  aiStudioService: AIStudioService;

  constructor(aiStudioService: AIStudioService) {
    this.aiStudioService = aiStudioService;
  }

  async generate({
    promptText,
    aspectRatio,
    blend,
    uid,
  }: ImageGenerationOptions): Promise<string> {
    const targetAR = aspectRatio.width / aspectRatio.height;
    const closestSize = Object.keys(AspectRatioToSizes).reduce((acc, cur) => {
      const curSize = AspectRatioToSizes[cur];
      const accSize = AspectRatioToSizes[acc];
      const curAR = curSize.width / curSize.height;
      const accAR = accSize.width / accSize.height;
      if (Math.abs(curAR - targetAR) < Math.abs(accAR - targetAR)) {
        return cur;
      }
      return acc;
    }, "1:1");
    const [width, height] = closestSize.split(":");

    const request = this.generateRequest({ promptText, width, height, blend });

    const genResponse = await this.aiStudioService.syncGenerateImage(
      blend.id,
      request,
      uid
    );

    return (
      ConfigProvider.AI_BLEND_PHOTOS_CDN_BASE_URL +
      genResponse.generatedImage.image
    );
  }

  private generateRequest({
    promptText,
    width,
    height,
    blend,
  }: {
    promptText: string;
    width: string;
    height: string;
    blend: Blend;
  }) {
    if (promptText) {
      return GenerateSamplesRequest.deserialize({
        $: "PromptBasedGenerationRequest",
        aspect: { width, height },
        productSuperCategory:
          blend.heroImages?.classificationMetadata?.productSuperClass,
        requestIndex: 0, // Ignored by AI Studio Generator
        promptText,
      });
    }

    return GenerateSamplesRequest.deserialize({
      $: "TopicBasedGenerationRequest",
      aspect: { width, height },
      productSuperCategory:
        blend.heroImages?.classificationMetadata?.productSuperClass,
      requestIndex: sample([1, 2, 3, 4]), // Pick top 4 except minimal (0)
      topicId: "Assorted-P2D",
    });
  }
}
