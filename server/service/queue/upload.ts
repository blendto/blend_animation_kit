import "reflect-metadata";
import { IService } from "server/service/index";
import { BlendService } from "server/service/blend";
import { BlendModelUtils } from "server/base/models/blend";
import { BatchService } from "server/service/batch";
import { BatchActionService } from "server/service/queue/batch/batchAction";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { injectable } from "inversify";
import {
  BatchTaskType,
  ImageUploadMessage,
} from "server/base/models/queue-messages";
import logger from "server/base/Logger";
import ConfigProvider from "server/base/ConfigProvider";
import BrandingService from "server/service/branding";
import { UserError } from "server/base/errors";

@injectable()
export class UploadService implements IService {
  batchActionService = diContainer.get<BatchActionService>(
    TYPES.BatchActionService
  );
  blendService = diContainer.get<BlendService>(TYPES.BlendService);
  batchService = diContainer.get<BatchService>(TYPES.BatchService);
  brandingService = diContainer.get<BrandingService>(TYPES.BrandingService);

  async processTrigger(message: ImageUploadMessage) {
    const bucket = message.Records[0].s3.bucket.name;
    const fileKey = decodeURIComponent(
      message.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    switch (bucket) {
      case ConfigProvider.HERO_IMAGES_BUCKET:
        await this.processHeroImageTrigger(fileKey);
        break;
      case ConfigProvider.BRANDING_BUCKET:
        await this.processBrandingLogoTrigger(fileKey);
        break;
      default:
        logger.error({
          op: "INVALID_S3_TRIGGER",
          message: `Unexpected trigger. Bucket: ${bucket}. File key: ${fileKey}`,
        });
    }
  }

  async processBrandingLogoTrigger(fileKey: string): Promise<void> {
    try {
      await this.brandingService.markLogoUploadAsDone(fileKey);
    } catch (error) {
      if (error instanceof UserError) {
        logger.error({
          op: "INVALID_BRANDING_LOGO_TRIGGER",
          message: error as object,
        });
        return;
      }
      throw error;
    }
  }

  async processHeroImageTrigger(fileKey: string): Promise<void> {
    const blendId = BlendModelUtils.getBlendIdFromFileKey(fileKey);
    if (!blendId) {
      logger.error({
        op: "INVALID_HERO_IMAGE_FILEKEY",
        message: `${fileKey} does not match "{blendId}/{filename}.{extension}" format`,
      });
      return;
    }

    const blend = await this.blendService.getBlend(blendId);
    if (!blend || blend.heroImages?.original !== fileKey) {
      logger.error({
        op: "NOT_HERO_IMAGE_FILEKEY",
        message: `Either, fileKey(${fileKey}) does not belong to a valid blend, or, is not of a hero image`,
      });
      return;
    }

    const { batchId } = blend;

    if (!batchId) {
      logger.error({
        op: "BLEND_NOT_FOUND",
        message: "Blend not a part of any batch",
      });
      return;
    }

    await this.batchActionService.queueBatchProcessingTask({
      batchId,
      blendId,
      type: BatchTaskType.process_upload,
    });
    await this.blendService.clearExpiry(blendId);
    await this.batchService.markUploadCompleted(blend.batchId, blendId);
  }
}
