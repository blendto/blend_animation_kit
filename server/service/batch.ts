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
import { BatchLevelEditStatus, Blend } from "server/base/models/blend";
import {
  copyObject,
  createDestinationFileKey,
  createSignedUploadUrl,
} from "server/external/s3";
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
import HeroImageService from "server/service/heroImage";
import { ExpressionAttributeNameMap } from "aws-sdk/clients/dynamodb";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import { IService } from "./index";

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
      throw new UserError("Invalid fileNames/heroImages", 400);
    }
  }

  async initUpload(
    batchId: string,
    uid: string,
    creationConfig: UploadRequestCreationConfig
  ): Promise<UploadRequests> {
    await this.initUploadValidations(batchId, uid, creationConfig);

    const promises = creationConfig.fileNames.map((fileName) =>
      BatchService.buildUploadRequest(fileName, uid, batchId)
    );
    const newBlendIdPromises = HeroImageService.createBatchBlends(
      creationConfig.heroImages,
      uid,
      batchId
    );

    const uploadRequests = await Promise.all(promises);
    await this.updateUploadRequests(batchId, uploadRequests);

    const blendsFromHeroImages = await Promise.all(newBlendIdPromises);
    await BatchService.enqueueBatchTask(
      batchId,
      blendsFromHeroImages.map((e) => e.blendId),
      BatchTaskType.process_operations
    );

    return { uploadRequests, blendsFromHeroImages } as UploadRequests;
  }

  private static async buildUploadRequest(
    fileName: string,
    uid: string,
    batchId: string
  ): Promise<UploadRequest> {
    const heroFileName = createDestinationFileKey(fileName, VALID_EXTENSIONS);
    const blend: Blend = await diContainer
      .get<BlendService>(TYPES.BlendService)
      .initBlend(uid, { batchId, heroFileName });

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
      fileName,
      blendId: blend.id,
      fileKey,
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
    expressionAttributeNames: ExpressionAttributeNameMap;
    expressionAttributeValues: Record<string, unknown>;
    expression: string;
  } {
    if (uploadRequests.length === 0) {
      return {
        expressionAttributeNames: {
          "#updatedAt": "updatedAt",
          "#status": "status",
        },
        expressionAttributeValues: {
          ":updatedAt": Date.now(),
          ":status": BatchState.PROCESSING,
        },
        expression: "SET #updatedAt = :updatedAt, #status = :status",
      };
    }

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
      UpdateExpression: `SET updatedAt = :updatedAt, previews.#blendId = :descriptor`,
      ExpressionAttributeNames: {
        "#blendId": blendId,
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":descriptor": { blendId, preview: previewFileKey },
      },
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async updateExport(batchId: string, blendId: string, output: unknown) {
    await this.dataStore.updateItem({
      UpdateExpression: `SET updatedAt = :updatedAt, outputs.#blendId = :descriptor`,
      ExpressionAttributeNames: {
        "#blendId": blendId,
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":descriptor": output,
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
    await BatchService.enqueueBatchTask(
      batch.id,
      updatedBatchOperations.blendsForPreviewRegeneration,
      BatchTaskType.process_operations
    );
  }

  async reInitIndividuallyEditedBlends(batchWrapper: BatchWrapper) {
    const blendIds: string[] = batchWrapper.getIndividuallyEditedBlends();
    const reInitAll = blendIds.map((id) => this.blendService.reInitialise(id));
    await Promise.all(reInitAll);
  }

  private static async enqueueBatchTask(
    batchId: string,
    blendIds: string[],
    taskType: BatchTaskType
  ): Promise<void> {
    const batchActionService = diContainer.get<BatchActionService>(
      TYPES.BatchActionService
    );
    const promises = blendIds.map(
      async (blendId) =>
        await batchActionService.queueBatchProcessingTask({
          batchId,
          blendId,
          type: taskType,
        })
    );
    await Promise.all(promises);
  }

  async applyRecipeToBatchBlend(
    batchId: string,
    blendId: string,
    uid: string
  ): Promise<void> {
    const blend = await this.blendService.getBlend(blendId);
    if (
      blend.batchLevelEditStatus === BatchLevelEditStatus.INDIVIDUALLY_EDITED
    ) {
      return;
    }
    const batch = await this.getBatch(batchId, uid);
    const operationProcessor = new BatchRecipeProcessor(batch, blend);
    const recipe = await operationProcessor.generateRecipe();

    const copyFilePromises = [];
    const { heroImages } = blend;
    let interactionUpdatePromise;

    const blendImages = recipe.images.map((image) => {
      if (image.uid === recipe.recipeDetails.elements.hero.uid) {
        const interaction = recipe.interactions.find(
          // eslint-disable-next-line eqeqeq
          (_) => _.assetType == "IMAGE" && _.assetUid == image.uid
        );
        // Starting from 2.5, we only show the cropped area in the mobile_app
        // instead of actually cropping the image and uploading it.
        // The hero image should not have cropRect property in a recipe as it
        // will get replaced.
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
      const uriParts = image.uri.split("/");
      uriParts[0] = blendId;
      const targetUri = uriParts.join("/");
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

  async exportBatch(batchId: string, uid: string) {
    const batch = await this.getBatch(batchId, uid, true);
    await BatchService.enqueueBatchTask(
      batchId,
      batch.blends,
      BatchTaskType.process_export
    );
    await this.dataStore.updateItem({
      UpdateExpression:
        "SET #updatedAt = :updatedAt, #status = :status, outputs = :outputs",
      ExpressionAttributeNames: {
        "#updatedAt": "updatedAt",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":status": BatchState.GENERATING,
        ":outputs": {},
      },
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async consolidateBatchStatus(updatedBatch: Batch) {
    const { id } = updatedBatch;

    switch (updatedBatch.status) {
      case BatchState.PROCESSING: {
        const blends = await this.blendService.getBlendIdsForBatch(id);
        if (Object.keys(updatedBatch.previews).length === blends.length) {
          await this.updateStatus(id, BatchState.IDLE);
        }
        break;
      }
      case BatchState.GENERATING: {
        const blends = await this.blendService.getBlendIdsForBatch(id);
        if (Object.keys(updatedBatch.outputs).length === blends.length) {
          await this.updateStatus(id, BatchState.GENERATED);
        }
        break;
      }
      default:
    }
  }

  async updateStatus(batchId: string, status: BatchState) {
    await this.dataStore.updateItem({
      UpdateExpression: "SET updatedAt = :updatedAt, #st = :st",
      ExpressionAttributeNames: {
        "#st": "status",
      },
      ExpressionAttributeValues: {
        ":st": status,
        ":updatedAt": Date.now(),
      },
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async getAllBatches(
    uid: string,
    pageKey: string
  ): Promise<{ batches: Batch[]; nextPageKey: string }> {
    const encodedPageKey = new EncodedPageKey(pageKey);
    if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
      throw new UserError("pageKey should be a string");
    }
    const pageKeyObject = encodedPageKey.decode();

    const data = await this.dataStore.queryItems({
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "createdBy-updatedAt-index",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":createdBy": uid,
        ":deleted": BatchState.DELETED,
      },
      ProjectionExpression: "id, batchPreviewFileKey, updatedAt, #status",
      FilterExpression: "#status <> :deleted",
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject as Record<string, unknown>,
      Limit: 15,
    });

    const batches = data.Items as Batch[];
    const nextPageKey = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;

    return { batches, nextPageKey };
  }
}
