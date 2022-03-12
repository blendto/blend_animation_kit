import "reflect-metadata";
import { IService } from "server/service/index";
import { BlendService } from "server/service/blend";
import { BlendModelUtils } from "server/base/models/blend";
import { BatchService } from "server/service/batch";
import { BatchActionService } from "server/service/queue/batch/batchAction";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { injectable } from "inversify";
import { BatchTaskType } from "server/base/models/queue-messages";
import logger from "server/base/Logger";

@injectable()
export class UploadService implements IService {
  async processHeroImageTrigger(
    bucket: string,
    fileKey: string
  ): Promise<void> {
    const blendId = BlendModelUtils.getBlendIdFromFileKey(fileKey);
    if (!blendId) {
      logger.error(
        `${fileKey} does not match "{blendId}/{filename}.{extension}" format`
      );
      return;
    }

    const batchActionService = diContainer.get<BatchActionService>(
      TYPES.BatchActionService
    );
    const blendService = diContainer.get<BlendService>(TYPES.BlendService);
    const batchService = diContainer.get<BatchService>(TYPES.BatchService);

    const blend = await blendService.getBlend(blendId);
    if (!blend || blend.heroImages?.original !== fileKey) {
      logger.info({
        op: "NOT_HERO_IMAGE_FILEKEY",
        message: `Either, fileKey(${fileKey}) does not belong to a valid blend, or, is not of a hero image`,
      });
      return;
    }

    const batchId = blend.batchId;

    if (!batchId) {
      console.info({
        op: "BLEND_NOT_FOUND",
        message: "Blend not a part of any batch",
      });
      return;
    }

    await batchActionService.queueBatchProcessingTask({
      batchId,
      blendId,
      type: BatchTaskType.process_upload,
    });
    await blendService.clearExpiry(blendId);
    await batchService.markUploadCompleted(blend.batchId, blendId);
  }
}
