import "reflect-metadata";
import { IService } from "server/service/index";
import {
  BatchTaskMessage,
  BatchTaskType,
} from "server/base/models/queue-messages";
import { QueueConfig } from "server/external/queue";
import { BatchTaskQueue } from "server/external/queue/batchTaskQueue";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { inject, injectable } from "inversify";
import { BatchService } from "server/service/batch";
import { RemoveBgService } from "server/internal/remove-bg-service";
import { BatchPreviewGenerator } from "server/service/queue/batch/batchPreviewGenerator";
import { RecipeService } from "server/service/recipe";
import BatchRecipeProcessor from "server/service/queue/batch/batchRecipeProcessor";

@injectable()
export class BatchActionService implements IService {
  @inject(TYPES.BatchTaskQueue) batchTaskQueue: BatchTaskQueue<QueueConfig>;
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.BatchService) batchService: BatchService;
  @inject(TYPES.RemoveBgService) removeBgService: RemoveBgService;
  @inject(TYPES.RecipeService) recipeService: RecipeService;

  async queueBatchProcessingTask(
    batchMessage: BatchTaskMessage
  ): Promise<void> {
    await this.batchTaskQueue.writeMessage(batchMessage);
  }

  async processTask(batchMessage: BatchTaskMessage) {
    switch (batchMessage.type) {
      case BatchTaskType.process_operations:
      case BatchTaskType.process_export:
        return await this.processOperations(batchMessage);
      case BatchTaskType.process_upload:
        return await this.processUpload(batchMessage);
    }
  }

  async processUpload(message: BatchTaskMessage): Promise<void> {
    const blend = await this.blendService.getBlend(message.blendId);
    let updatedHeroImages = await this.removeBgService.removeBgAndStore(
      blend.heroImages
    );
    if (updatedHeroImages.updated) {
      await this.blendService.addHeroKeysToBlend(
        blend.id,
        updatedHeroImages.fileKeys
      );
    }
    await this.queueBatchProcessingTask({
      ...message,
      type: BatchTaskType.process_operations,
    });
  }

  async processOperations(message: BatchTaskMessage): Promise<void> {
    const blend = await this.blendService.getBlend(message.blendId);
    const batch = await this.batchService.getBatch(
      blend.batchId,
      blend.createdBy,
      true
    );

    const operationProcessor = new BatchRecipeProcessor(batch, blend);
    const recipe = await operationProcessor.generateRecipe();
    const previewGenerator = new BatchPreviewGenerator(blend, batch, recipe);

    switch (message.type) {
      case BatchTaskType.process_operations:
        return previewGenerator.savePreview();
      case BatchTaskType.process_export:
        return previewGenerator.saveExport();
    }
  }
}
