import { DynamoBasedServiceLocator, IService } from "./index";
import DynamoDB from "server/external/dynamodb";
import { BlendService } from "server/service/blend";
import { BlendModelUtils } from "server/base/models/blend";
import { BatchService } from "server/service/batch";

export class UploadService implements IService {
  dataStore: DynamoDB;
  serviceLocator: DynamoBasedServiceLocator;

  constructor(dataStore: DynamoDB, serviceLocator: DynamoBasedServiceLocator) {
    this.dataStore = dataStore;
    this.serviceLocator = serviceLocator;
  }

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

    const blendService = this.serviceLocator.find(BlendService);
    const batchService = this.serviceLocator.find(BatchService);

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
