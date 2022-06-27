import "reflect-metadata";
import DynamoDB from "server/external/dynamodb";
import {
  Batch,
  BatchItemExport,
  BatchItemPreview,
  BatchModelValidators,
  BatchState,
  BatchWrapper,
  UploadMethod,
  UploadRequest,
  UploadRequestCreationConfig,
  UploadRequests,
} from "server/base/models/batch";

import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import ConfigProvider from "server/base/ConfigProvider";
import { ObjectNotFoundError, UserError } from "server/base/errors";
import { BatchLevelEditStatus, Blend } from "server/base/models/blend";
import {
  createDestinationFileKey,
  createSignedUploadUrl,
  GetSignedUrlOperation,
} from "server/external/s3";
import { customAlphabet } from "nanoid";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import {
  BatchOperation,
  IndividualBlendEditOperation,
} from "server/base/models/batchOperations";
import { BatchTaskType } from "server/base/models/queue-messages";
import { diContainer } from "inversify.config";
import BatchRecipeProcessor from "server/service/queue/batch/batchRecipeProcessor";
import { BatchActionService } from "server/service/queue/batch/batchAction";
import { BatchOperationHandler } from "server/service/queue/batch/batchOperationHandler";
import HeroImageService from "server/service/heroImage";
import { ExpressionAttributeNameMap } from "aws-sdk/clients/dynamodb";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import { fireAndForget } from "server/helpers/async-runner";
import { IService } from "server/service/index";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "server/helpers/constants";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

type UpdateRequest = {
  updateExpression: string;
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues?: Record<string, string>;
};

const AtoZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

@injectable()
export class BatchService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.BlendService) blendService: BlendService;

  async getBatch(
    batchId: string,
    uid: string,
    includeBlendIds = false,
    consolidateStatus = false
  ): Promise<Batch> {
    const batch = (await this.dataStore.getItem({
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      Key: { id: batchId },
    })) as Batch | null;

    if (batch == null || ![uid].includes(batch.createdBy)) {
      return null;
    }
    if (includeBlendIds || consolidateStatus) {
      batch.blends = await this.blendService.getBlendIdsForBatch(batchId);
    }

    if (consolidateStatus) {
      return this.consolidateBatchStatusInBg(batch);
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
      throw new ObjectNotFoundError("No such batch for user");
    }

    if (
      !BatchModelValidators.validateRequestConfig(uploadRequestCreationConfig)
    ) {
      throw new UserError("Invalid fileNames/heroImages");
    }
  }

  async initUpload(
    batchId: string,
    uid: string,
    creationConfig: UploadRequestCreationConfig
  ): Promise<UploadRequests> {
    await this.initUploadValidations(batchId, uid, creationConfig);

    const promises = creationConfig.fileNames.map((fileName) =>
      BatchService.buildUploadRequest(
        fileName,
        uid,
        batchId,
        creationConfig.method
      )
    );
    const newBlendIdPromises = HeroImageService.createBatchBlends(
      creationConfig.heroImages,
      uid,
      batchId
    );

    const uploadRequests = await Promise.all(promises);
    await this.updateUploadRequests(batchId, uploadRequests);

    const blendsFromHeroImages = await Promise.all(newBlendIdPromises);
    const blendIds = blendsFromHeroImages.map((e) => e.blendId);

    await this.blendService.clearExpiry(blendIds);
    await BatchService.enqueueBatchTask(
      batchId,
      blendIds,
      BatchTaskType.process_operations
    );

    return { uploadRequests, blendsFromHeroImages } as UploadRequests;
  }

  private static async buildUploadRequest(
    fileName: string,
    uid: string,
    batchId: string,
    method: UploadMethod
  ): Promise<UploadRequest> {
    const heroFileName = createDestinationFileKey(
      fileName,
      VALID_UPLOAD_IMAGE_EXTENSIONS
    );
    const blend: Blend = await diContainer
      .get<BlendService>(TYPES.BlendService)
      .initBlend(uid, { batchId, heroFileName });

    const fileKey = `${blend.id}/${heroFileName}`;
    if (method === UploadMethod.PUT) {
      const url = (await createSignedUploadUrl(
        fileName,
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        VALID_UPLOAD_IMAGE_EXTENSIONS,
        {
          outFileKey: fileKey,
          maxSize: MAX_FILE_SIZE,
          operation: GetSignedUrlOperation.putObject,
        }
      )) as string;

      return {
        fileName,
        blendId: blend.id,
        fileKey,
        presignedUploadUrl: url,
      };
    }

    const urlDetails = (await createSignedUploadUrl(
      fileName,
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      VALID_UPLOAD_IMAGE_EXTENSIONS,
      {
        outFileKey: fileKey,
        maxSize: MAX_FILE_SIZE,
        operation: GetSignedUrlOperation.postObject,
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { presignedUploadRequest, presignedUploadUrl, ...required } =
        request;
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
      const key = customAlphabet(AtoZ, 10)();
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
    preview: string,
    failed = false
  ) {
    await this.dataStore.updateItem({
      UpdateExpression: `SET updatedAt = :updatedAt, previews.#blendId = :descriptor`,
      ExpressionAttributeNames: {
        "#blendId": blendId,
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":descriptor": { blendId, preview, failed } as BatchItemPreview,
      },
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async updateThumbnail(batchId: string, thumbnailFileKey: string) {
    await this.dataStore.updateItem({
      UpdateExpression: `SET updatedAt = :updatedAt, thumbnail = :thumbnail`,
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":thumbnail": thumbnailFileKey,
      },
      Key: { id: batchId },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  async updateExport(
    batchId: string,
    blendId: string,
    output: unknown,
    failed = false
  ) {
    await this.dataStore.updateItem({
      UpdateExpression: `SET updatedAt = :updatedAt, outputs.#blendId = :descriptor`,
      ExpressionAttributeNames: {
        "#blendId": blendId,
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":descriptor": { blendId, output, failed } as BatchItemExport,
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
        "SET updatedAt = :updatedAt, #operations = :operations, #st = :st, #outputs = :outputs" +
        updatedBatchOperations.outputsDeleteRequest.removeExpression,
      ExpressionAttributeNames: {
        "#operations": "operations",
        "#outputs": "outputs",
        "#st": "status",
        ...updatedBatchOperations.outputsDeleteRequest.expressionAttributeNames,
      },
      ExpressionAttributeValues: {
        ":st": BatchState.PROCESSING,
        ":updatedAt": Date.now(),
        ":operations": updatedBatchOperations.updatedOperations,
        ":outputs": {},
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
    const blend = await this.blendService.getBlend(blendId, null, true);
    if (
      blend.batchLevelEditStatus === BatchLevelEditStatus.INDIVIDUALLY_EDITED
    ) {
      return;
    }
    const batch = await this.getBatch(batchId, uid);
    const operationProcessor = new BatchRecipeProcessor(batch, blend);
    const recipe = await operationProcessor.generateRecipe();

    const { heroImages } = blend;

    await this.blendService.copyRecipeToBlend(blendId, heroImages, recipe);
    await this.applyOperation(
      batchId,
      uid,
      new IndividualBlendEditOperation(blendId)
    );
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

  consolidateBatchStatusInBg(batch: Batch): Batch {
    const { id, blends } = batch;
    const updateStatus = (status: BatchState) => {
      fireAndForget(() => this.updateStatus(id, status)).catch(() => {});
      batch.status = status;
    };

    switch (batch.status) {
      case BatchState.PROCESSING: {
        if (Object.keys(batch.previews).length >= blends.length) {
          updateStatus(BatchState.IDLE);
        }
        break;
      }
      case BatchState.GENERATING: {
        if (Object.keys(batch.outputs).length >= blends.length) {
          updateStatus(BatchState.GENERATED);
        }
        break;
      }
      default:
    }
    return batch;
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
        ":emptyMap": {},
      },
      ProjectionExpression: "id, updatedAt, #status, thumbnail",
      FilterExpression: "#status <> :deleted and previews <> :emptyMap",
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject as Record<string, unknown>,
      Limit: 15,
    });

    const batches = data.Items as Batch[];
    const nextPageKey = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;

    return { batches, nextPageKey };
  }

  async deleteBatchedBlends(id: string, uid: string, blendIds: string[]) {
    const batch = await this.getBatch(id, uid, true);
    await this.deleteBatchedBlendsInternal(batch, blendIds, false);
  }

  async deleteBatch(id: string, uid: string) {
    const batch = await this.getBatch(id, uid, true);
    await this.deleteBatchedBlendsInternal(batch, batch.blends, true);
  }

  private async deleteBatchedBlendsInternal(
    batch: Batch,
    blendsToDelete: string[],
    shouldDeleteBatch: boolean
  ) {
    if (!batch) {
      throw new UserError("Invalid batch for user.");
    }
    const invalidBlends = blendsToDelete.filter(
      (id) => !batch.blends.includes(id)
    );
    if (invalidBlends.length > 0) {
      throw new UserError(
        `Blends (${invalidBlends.toString()}) not present for batch`
      );
    }

    const deletePromises = blendsToDelete.map((id) =>
      this.blendService.deleteBlend(id)
    );
    await Promise.all(deletePromises);
    const updateRequest = this.batchItemsDeleteRequest(
      blendsToDelete,
      shouldDeleteBatch
    );
    await this.dataStore.updateItem({
      UpdateExpression: updateRequest.updateExpression,
      ExpressionAttributeNames: updateRequest.expressionAttributeNames,
      ExpressionAttributeValues: updateRequest.expressionAttributeValues,
      Key: { id: batch.id },
      TableName: ConfigProvider.BATCH_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  private batchItemsDeleteRequest(
    blendIds: string[],
    shouldDeleteBatch: boolean
  ): UpdateRequest {
    const request = {
      updateExpression: null,
      expressionAttributeNames: {},
      expressionAttributeValues: null,
    } as UpdateRequest;

    const operationGroups: string[] = [];
    if (shouldDeleteBatch) {
      operationGroups.push("SET #st = :st");
      request.expressionAttributeNames["#st"] = "status";
      request.expressionAttributeValues = { ":st": BatchState.DELETED };
    }

    const expressionItems: string[] = [];
    blendIds.forEach((id) => {
      const key = customAlphabet(AtoZ, 10)();
      request.expressionAttributeNames[`#${key}`] = id;
      expressionItems.push(`previews.#${key}`);
      expressionItems.push(`outputs.#${key}`);
      expressionItems.push(`pendingUploads.#${key}`);
    });
    if (blendIds.length > 0) {
      operationGroups.push("REMOVE " + expressionItems.join(", "));
    }

    request.updateExpression = operationGroups.join(" ");
    return request;
  }
}
