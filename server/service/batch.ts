import DynamoDB from "server/external/dynamodb";
import {
  Batch,
  BatchModelValidators,
  UploadRequest,
  UploadRequestCreationConfig,
  UploadRequests,
} from "server/base/models/batch";
import { initBlendInternal } from "pages/api/blend";

import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import {
  createDestinationFileKey,
  createSignedUploadUrl,
} from "server/external/s3";
import { IService } from "./index";
import { customAlphabet } from "nanoid";

const VALID_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export class BatchService implements IService {
  dataStore: DynamoDB;

  constructor(dataStore: DynamoDB) {
    this.dataStore = dataStore;
  }

  async getBatch(batchId: string, uid: string): Promise<Batch> {
    const batch = (await this.dataStore.getItem({
      TableName: process.env.BATCH_DYNAMODB_TABLE,
      Key: { id: batchId },
    })) as Batch | null;

    if (batch == null || ![uid].includes(batch.createdBy)) {
      return null;
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
    const blend: Blend = await initBlendInternal(uid, {
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
      TableName: process.env.BATCH_DYNAMODB_TABLE,
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
      TableName: process.env.BATCH_DYNAMODB_TABLE,
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
      },
      expressionAttributeValues: {
        ":updatedAt": Date.now(),
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
      "SET #updatedAt = :updatedAt, " + expressionItems.join(", ");
    return updates;
  }
}
