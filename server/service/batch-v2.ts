import "reflect-metadata";
import DynamoDB from "server/external/dynamodb";
import { Batch, BatchBlend, BatchState } from "server/base/models/batch-v2";
import ConfigProvider from "server/base/ConfigProvider";
import { ObjectNotFoundError, UserError } from "server/base/errors";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import { IService } from "server/service/index";
import { nanoid } from "nanoid";
import { DocumentClient } from "aws-sdk/lib/dynamodb/document_client";
import { diContainer } from "inversify.config";
import { RecipeSource, RecipeVariantId } from "server/base/models/recipeList";
import { IllegalBatchAccessError } from "server/base/errors/engine/batchEngineErrors";

@injectable()
export class BatchV2Service implements IService {
  @inject(TYPES.BlendService) blendService: BlendService;
  batchDao: BatchDao = new BatchDao();

  async createBatch(uid: string): Promise<Batch> {
    const now = Date.now();
    const newBatch = {
      id: nanoid(10),
      status: BatchState.INITIALIZED,
      blends: [],
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      outputs: {},
      baseRecipe: {
        id: "Solid0035",
        variant: "1:1",
        source: RecipeSource.DEFAULT,
      },
    } as Batch;

    await this.batchDao.putBatch(newBatch);
    return newBatch;
  }

  async getBatch(batchId: string, uid: string): Promise<Batch> {
    return await this.batchDao.getUserBatch(batchId, uid);
  }

  async getBatchOrFail(batchId: string, uid: string): Promise<Batch> {
    const batch = await this.getBatch(batchId, uid);
    if (!batch) {
      throw new ObjectNotFoundError("Invalid batch for user.");
    }
    return batch;
  }

  async getUserBatches(
    uid: string,
    pageKey: string
  ): Promise<{ batches: Batch[]; nextPageKey: string }> {
    const encodedPageKey = new EncodedPageKey(pageKey);
    if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
      throw new UserError("pageKey should be a string");
    }
    const pageKeyObject = encodedPageKey.decode();

    const data = await this.batchDao.queryItems(uid, pageKeyObject);

    const batches = data.Items as Batch[];
    const nextPageKey = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;

    return { batches, nextPageKey };
  }

  async deleteBatch(id: string, uid: string) {
    await this.updateBatch(id, uid, []);
    await this.markBatchAsDeleted(id);
  }

  async updateBatch(
    batchId: string,
    uid: string,
    blends: BatchBlend[],
    baseRecipe?: RecipeVariantId
  ): Promise<Batch> {
    const batch = await this.getBatchOrFail(batchId, uid);
    await this.deleteRemovedBlends(batch, blends);
    return await this.batchDao.updateBlends(
      batch.id,
      baseRecipe ?? batch.baseRecipe,
      blends
    );
  }

  private async deleteRemovedBlends(batch: Batch, blends: BatchBlend[]) {
    const blendIdsToKeep = blends.map((b) => b.blendId);
    const batchBlendIds = await this.blendService.getBlendIdsForBatch(batch.id);

    const blendIdsToDelete = batchBlendIds.filter(
      (id) => !blendIdsToKeep.includes(id)
    );
    const promises = blendIdsToDelete.map((id) =>
      this.blendService.deleteBlend(id)
    );
    await Promise.all(promises);
  }

  async markBatchAsDeleted(batchId: string) {
    await this.batchDao.updateStatus(batchId, BatchState.DELETED);
  }
}

class BatchDao {
  dataStore: DynamoDB;
  tableName: string = ConfigProvider.BATCH_V2_DYNAMODB_TABLE;

  constructor() {
    this.dataStore = diContainer.get<DynamoDB>(TYPES.DynamoDB);
  }

  async putBatch(newBatch: Batch) {
    await this.dataStore.putItem({
      TableName: this.tableName,
      Item: newBatch,
    });
  }

  async getUserBatch(batchId: string, uid: string): Promise<Batch> {
    const batch = (await this.dataStore.getItem({
      TableName: this.tableName,
      Key: { id: batchId },
    })) as Batch | null;

    const { createdBy } = batch;
    if (createdBy !== uid) {
      IllegalBatchAccessError.logIllegalBatchAccess(batchId, createdBy, uid);
      return null;
    }
    return batch;
  }

  async queryItems(
    uid: string,
    pageKeyObject: Record<string, unknown>
  ): Promise<DocumentClient.QueryOutput> {
    return await this.dataStore.queryItems({
      TableName: this.tableName,
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
      ProjectionExpression: "id, updatedAt, #status, thumbnail",
      FilterExpression: "#status <> :deleted",
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject,
      Limit: 15,
    });
  }

  async updateBlends(
    id: string,
    baseRecipe: RecipeVariantId,
    blends: BatchBlend[]
  ): Promise<Batch> {
    return (
      await this.dataStore.updateItem({
        UpdateExpression:
          "SET #blends = :blends, #baseRecipe = :baseRecipe, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#blends": "blends",
          "#baseRecipe": "baseRecipe",
        },
        ExpressionAttributeValues: {
          ":blends": blends,
          ":baseRecipe": baseRecipe,
          ":updatedAt": Date.now(),
        },
        Key: { id },
        TableName: this.tableName,
        ReturnValues: "ALL_NEW",
      })
    ).Attributes as Batch;
  }

  async updateStatus(id: string, status: BatchState) {
    await this.dataStore.updateItem({
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": Date.now(),
      },
      Key: { id },
      TableName: this.tableName,
      ReturnValues: "NONE",
    });
  }
}
