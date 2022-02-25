import "reflect-metadata";
import { IService } from "./index";
import { BlendService } from "server/service/blend";
import { BlendModelUtils } from "server/base/models/blend";
import { BatchService } from "server/service/batch";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { injectable } from "inversify";

@injectable()
export class UploadService implements IService {
  async processHeroImageTrigger(
    bucket: string,
    fileKey: string
  ): Promise<void> {
    const blendId = BlendModelUtils.getBlendIdFromFileKey(fileKey);
    if (!blendId) {
      console.error(
        `${fileKey} does not match "{blendId}/{filename}.{extension}" format`
      );
      return;
    }

    const blendService = diContainer.get<BlendService>(TYPES.BlendService);
    const batchService = diContainer.get<BatchService>(TYPES.BatchService);

    const blend = await blendService.getBlend(blendId);
    if (!blend || blend.heroImages?.original !== fileKey) {
      console.info({
        op: "NOT_HERO_IMAGE_FILEKEY",
        message: `Either, fileKey(${fileKey}) does not belong to a valid blend, or, is not of a hero image`,
      });
      return;
    }

    if (!blend.batchId) {
      console.info({
        op: "BLEND_NOT_FOUND",
        message: "Blend not a part of any batch",
      });
      return;
    }
    await batchService.markUploadCompleted(blend.batchId, blendId);
  }
}
