import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import {
  BatchOperation,
  BatchOperationType,
  IndividualBlendEditOperation,
} from "server/base/models/batchOperations";

export enum BatchState {
  IDLE = "IDLE",
  PROCESSING = "PROCESSING",
  GENERATING = "GENERATING",
  GENERATED = "GENERATED",
  DELETED = "DELETED",
}

export interface UploadRequestCreationConfig {
  fileNames: string[];
  heroImages: string[];
}

export interface UploadRequest {
  fileName: string;
  blendId: string;
  fileKey: string;
  presignedUploadRequest: PresignedPost;
}

export type BlendFromHeroImage = {
  blendId: string;
  heroImageId: string;
};

export interface UploadRequests {
  uploadRequests: UploadRequest[];
  blendsFromHeroImages: BlendFromHeroImage[];
}

export type BatchItemPreview = {
  blendId: string;
  preview: string;
};

export interface Batch {
  id: string;
  status: BatchState;
  blends: string[];
  pendingUploads: Record<string, UploadRequest>;
  operations: BatchOperation[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  previews: Record<string, BatchItemPreview>;
  batchPreviewFileKey?: string;
  outputs: Record<string, unknown>;
}

export class BatchWrapper {
  batch: Batch;

  constructor(batch: Batch) {
    this.batch = batch;
  }

  isBlendModified(blendId: string) {
    return this.batch.operations.some(
      (operation) =>
        operation.op === BatchOperationType.individual_blend_edit &&
        (operation as IndividualBlendEditOperation).blendId === blendId
    );
  }

  getIndividuallyEditedBlends(): string[] {
    return this.batch.operations
      .filter(
        (operation) => operation.op === BatchOperationType.individual_blend_edit
      )
      .map((operation) => (operation as IndividualBlendEditOperation).blendId);
  }
}

export class BatchModelValidators {
  static validateRequestConfig(request: UploadRequestCreationConfig): boolean {
    const { fileNames, heroImages } = request;
    const names: string[] = [...fileNames, ...heroImages];
    const length = names?.length;
    if (!length) {
      return false;
    }

    return length > 0 && length <= 20 && length === new Set(names).size;
  }
}
