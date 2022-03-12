import "reflect-metadata";
import DynamoDB from "server/external/dynamodb";
import {
  Batch,
  BatchModelValidators,
  BatchState,
  BatchWrapper,
  UploadRequest,
  UploadRequestCreationConfig,
  UploadRequests,
} from "server/base/models/batch";

import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import { Blend, BlendStatus } from "server/base/models/blend";
import {
  copyObject,
  createDestinationFileKey,
  createSignedUploadUrl,
} from "server/external/s3";
import { IService } from "./index";
import { customAlphabet } from "nanoid";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import { BatchOperation } from "server/base/models/batchOperations";
import { BatchTaskType } from "server/base/models/queue-messages";
import { diContainer } from "inversify.config";
import BatchRecipeProcessor from "server/service/queue/batch/batchRecipeProcessor";
import { ImageMetadata } from "server/base/models/recipe";
import { BatchActionService } from "server/service/queue/batch/batchAction";
import { BatchOperationHandler } from "server/service/queue/batch/batchOperationHandler";
import { adjustSizeToFit } from "server/helpers/imageUtils";

const VALID_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

@injectable()
export class BatchService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.BlendService) blendService: BlendService;

  async getBatch(
    batchId: string,
    uid: string,
    includeBlendIds = false
  ): Promise<Batch> {
    const batch = (await this.dataStore.getItem({
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      Key: { id: batchId },
    })) as Batch | null;

    if (batch == null || ![uid].includes(batch.createdBy)) {
      return null;
    }
    if (includeBlendIds) {
      batch.blends = await this.blendService.getBlendIdsForBatch(batchId);
    }

    return batch;
  }

  private async initUploadValidations(
    batchId: string,
    uid: string,
    uploadRequestCreationConfig: UploadRequestCreationConfig
  ) {
    const batch = await this.getBatch(batchId, uid);
    if (!batch) {
      throw new UserError("No such batch for user", 404);
    }

    if (
      !BatchModelValidators.validateRequestConfig(uploadRequestCreationConfig)
    ) {
      throw new UserError("Invalid fileNames", 400);
    }
  }

  async initUpload(
    batchId: string,
    uid: string,
    uploadRequestCreationConfig: UploadRequestCreationConfig
  ): Promise<UploadRequests> {
    await this.initUploadValidations(batchId, uid, uploadRequestCreationConfig);

    const promises = uploadRequestCreationConfig.fileNames.map((fileName) =>
      BatchService.buildUploadRequest(fileName, uid, batchId)
    );
    const uploadRequests = await Promise.all(promises);
    await this.updateUploadRequests(batchId, uploadRequests);
    return { uploadRequests: uploadRequests } as UploadRequests;
  }

  private static async buildUploadRequest(
    fileName: string,
    uid: string,
    batchId: string
  ): Promise<UploadRequest> {
    const heroFileName = createDestinationFileKey(fileName, VALID_EXTENSIONS);
    const blend: Blend = await diContainer
      .get<BlendService>(TYPES.BlendService)
      .initBlend(uid, {
        batchId: batchId,
        heroFileName: heroFileName,
      });

    const fileKey = `${blend.id}/${heroFileName}`;
    const urlDetails = (await createSignedUploadUrl(
      fileName,
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      VALID_EXTENSIONS,
      {
        outFileKey: fileKey,
        maxSize: MAX_FILE_SIZE,
      }
    )) as PresignedPost;

    return {
      fileName: fileName,
      blendId: blend.id,
      fileKey: fileKey,
      presignedUploadRequest: urlDetails,
    };
  }

  private async updateUploadRequests(
    batchId: string,
    uploadRequests: UploadRequest[]
  ) {
    const updates = this.constructBulkUpdate(uploadRequests);
    await this.dataStore.updateItem({
      UpdateExpression: updates.expression,
      ExpressionAttributeNames: updates.expressionAttributeNames,
      ExpressionAttributeValues: updates.expressionAttributeValues,
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  private withoutPresignedUrls(
    uploadRequests: UploadRequest[]
  ): UploadRequest[] {
    return uploadRequests.map((request) => {
      const { presignedUploadRequest, ...required } = request;
      return required as UploadRequest;
    });
  }

  async markUploadCompleted(batchId: string, blendId: string): Promise<void> {
    await this.dataStore.updateItem({
      UpdateExpression: `SET updatedAt = :updatedAt REMOVE pendingUploads.#toDelete`,
      ExpressionAttributeNames: {
        "#toDelete": blendId,
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
      },
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  private constructBulkUpdate(uploadRequests: UploadRequest[]): {
    expressionAttributeNames;
    expressionAttributeValues;
    expression;
  } {
    const updates = {
      expressionAttributeNames: {
        "#updatedAt": "updatedAt",
        "#pendingUploads": "pendingUploads",
        "#status": "status",
      },
      expressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":status": BatchState.PROCESSING,
      },
      expression: null,
    };
    const expressionItems: string[] = [];
    this.withoutPresignedUrls(uploadRequests).forEach((uploadRequest) => {
      const key = customAlphabet(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        10
      )();
      updates.expressionAttributeNames[`#${key}`] = uploadRequest.blendId;
      updates.expressionAttributeValues[`:${key}`] = uploadRequest;
      expressionItems.push(`#pendingUploads.#${key} = :${key}`);
    });

    updates.expression =
      "SET #updatedAt = :updatedAt, #status = :status, " +
      expressionItems.join(", ");
    return updates;
  }

  async updatePreview(
    batchId: string,
    blendId: string,
    previewFileKey: string
  ) {
    await this.dataStore.updateItem({
      UpdateExpression: `SET updatedAt = :updatedAt, outputs.#blendId = :descriptor`,
      ExpressionAttributeNames: {
        "#blendId": blendId,
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":descriptor": {
          blendId: blendId,
          preview: previewFileKey,
        },
      },
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async applyOperation(
    batchId: string,
    uid: string,
    incomingOperation: BatchOperation
  ): Promise<void> {
    const batch = await this.getBatch(batchId, uid, true);
    const updatedBatchOperations =
      await BatchOperationHandler.updatedBatchOperations(
        batch,
        incomingOperation
      );

    await this.dataStore.updateItem({
      UpdateExpression:
        "SET updatedAt = :updatedAt, #operations = :operations, #st = :st" +
        updatedBatchOperations.outputsDeleteRequest.removeExpression,
      ExpressionAttributeNames: {
        "#operations": "operations",
        "#st": "status",
        ...updatedBatchOperations.outputsDeleteRequest.expressionAttributeNames,
      },
      ExpressionAttributeValues: {
        ":st": BatchState.PROCESSING,
        ":updatedAt": Date.now(),
        ":operations": updatedBatchOperations.updatedOperations,
      },
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
    await BatchService.seedProcessActionsToQueue(
      batch.id,
      updatedBatchOperations.blendsForPreviewRegeneration
    );
  }

  async reInitIndividuallyEditedBlends(batchWrapper: BatchWrapper) {
    const blendIds: string[] = batchWrapper.getIndividuallyEditedBlends();
    const reInitAll = blendIds.map((id) => this.blendService.reInitialise(id));
    await Promise.all(reInitAll);
  }

  private static async seedProcessActionsToQueue(
    batchId: string,
    blendIds: string[]
  ): Promise<void> {
    const batchActionService = diContainer.get<BatchActionService>(
      TYPES.BatchActionService
    );
    for (const blendId of blendIds) {
      await batchActionService.queueBatchProcessingTask({
        batchId: batchId,
        blendId: blendId,
        type: BatchTaskType.process_operations,
      });
    }
  }

  async applyRecipeToBatchBlend(
    batchId: string,
    blendId: string,
    uid: string
  ): Promise<void> {
    const blend = await this.blendService.getBlend(blendId);
    if ([BlendStatus.Submitted, BlendStatus.Generated].includes(blend.status)) {
      return;
    }
    const batch = await this.getBatch(batchId, uid);
    const operationProcessor = new BatchRecipeProcessor(batch, blend);
    const recipe = await operationProcessor.generateRecipe();

    let copyFilePromises = [];
    const heroImages = blend.heroImages;
    let interactionUpdatePromise;

    const blendImages = recipe.images.map((image) => {
      if (image.uid === recipe.recipeDetails.elements.hero.uid) {
        const interaction = recipe.interactions.find(
          (interaction) =>
            interaction.assetType == "IMAGE" &&
            interaction.assetUid == image.uid
        );
        // Starting from 2.5, we only show the cropped area in the mobile_app instead of actually cropping the image and uploading it.
        // The hero image should not have cropRect property in a recipe as it will get replaced.
        (interaction.metadata as ImageMetadata).cropRect = null;
        if ((interaction.metadata as ImageMetadata).hasBgRemoved) {
          interactionUpdatePromise = adjustSizeToFit(
            interaction,
            heroImages.withoutBg
          );
          return { ...image, uri: heroImages.withoutBg };
        }
        interactionUpdatePromise = adjustSizeToFit(
          interaction,
          heroImages.original
        );
        return { ...image, uri: heroImages.original };
      }
      let uriParts = image.uri.split("/");
      uriParts[0] = blendId;
      let targetUri = uriParts.join("/");
      copyFilePromises.push(
        copyObject(
          ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
          image.uri,
          ConfigProvider.BLEND_INGREDIENTS_BUCKET,
          targetUri
        )
      );
      return { ...image, uri: targetUri };
    });
    await Promise.all(copyFilePromises.concat([interactionUpdatePromise]));

    const modifiedBlend = {
      ...recipe,
      metadata: {
        ...recipe.metadata,
        sourceRecipeId: recipe.id,
        sourceRecipe: { id: recipe.id, variant: recipe.variant },
      },
      id: blendId,
      images: blendImages,
    } as Blend;

    await this.blendService.updateBlend(modifiedBlend);
  }
}
