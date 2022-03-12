import { Batch, BatchWrapper } from "server/base/models/batch";
import {
  BatchOperation,
  BatchOperationType,
  IndividualBlendEditOperation,
  SelectRecipeOperation,
} from "server/base/models/batchOperations";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BatchService } from "server/service/batch";
import { UserError } from "server/base/errors";
import { customAlphabet } from "nanoid";

type BatchOutputsDeleteRequest = {
  removeExpression: string;
  expressionAttributeNames: Record<string, string>;
};

type UpdatedBatchOperations = {
  updatedOperations: BatchOperation[];
  blendsForPreviewRegeneration: string[];
  outputsDeleteRequest: BatchOutputsDeleteRequest;
};

export class BatchOperationHandler {
  static async updatedBatchOperations(
    batch: Batch,
    incomingOperation: BatchOperation
  ): Promise<UpdatedBatchOperations> {
    switch (incomingOperation.op) {
      case BatchOperationType.select_recipe:
        const selectOp = incomingOperation as SelectRecipeOperation;
        return new SelectRecipeHandler(selectOp).handle(batch);
      case BatchOperationType.individual_blend_edit:
        const editOp = incomingOperation as IndividualBlendEditOperation;
        return new IndividualBlendEditHandler(editOp).handle(batch);
    }
    throw new UserError(`Unknown BatchOperationType: ${incomingOperation.op}`);
  }

  constructOutputsDeleteRequest(blends: string[]): BatchOutputsDeleteRequest {
    const updates: BatchOutputsDeleteRequest = {
      expressionAttributeNames: {},
      removeExpression: null,
    };
    const expressionItems: string[] = [];
    blends.forEach((blendId) => {
      const key = customAlphabet(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        10
      )();
      updates.expressionAttributeNames[`#${key}`] = blendId;
      expressionItems.push(`outputs.#${key}`);
    });
    updates.removeExpression = " REMOVE " + expressionItems.join(", ");
    return updates;
  }
}

export class SelectRecipeHandler extends BatchOperationHandler {
  incomingOperation: SelectRecipeOperation;
  constructor(operation: SelectRecipeOperation) {
    super();
    this.incomingOperation = operation;
  }

  async handle(batch: Batch): Promise<UpdatedBatchOperations> {
    await diContainer
      .get<BatchService>(TYPES.BatchService)
      .reInitIndividuallyEditedBlends(new BatchWrapper(batch));
    return {
      updatedOperations: [this.incomingOperation],
      blendsForPreviewRegeneration: batch.blends,
      outputsDeleteRequest: this.constructOutputsDeleteRequest(batch.blends),
    };
  }
}

export class IndividualBlendEditHandler extends BatchOperationHandler {
  incomingOperation: IndividualBlendEditOperation;
  constructor(operation: IndividualBlendEditOperation) {
    super();
    this.incomingOperation = operation;
  }
  handle(batch: Batch): UpdatedBatchOperations {
    const batchWrapper = new BatchWrapper(batch);
    const blendId = this.incomingOperation.blendId;
    if (!batchWrapper.isBlendModified(blendId)) {
      return {
        updatedOperations: [...batch.operations, this.incomingOperation],
        blendsForPreviewRegeneration: [blendId],
        outputsDeleteRequest: this.constructOutputsDeleteRequest([blendId]),
      };
    }
    return {
      updatedOperations: [...batch.operations],
      blendsForPreviewRegeneration: [blendId],
      outputsDeleteRequest: this.constructOutputsDeleteRequest([blendId]),
    };
  }
}
