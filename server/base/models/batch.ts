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

export enum UploadMethod {
  PUT = "PUT",
  POST = "POST",
}

export interface UploadRequestCreationConfig {
  fileNames: string[];
  heroImages: string[];
  method?: UploadMethod;
}

export interface UploadRequest {
  fileName: string;
  blendId: string;
  fileKey: string;
  presignedUploadRequest?: PresignedPost;
  presignedUploadUrl?: string;
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
  preview?: string;
  failed: boolean;
};

export type BatchItemExport = {
  blendId: string;
  output?: unknown;
  failed: boolean;
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
  thumbnail?: string;
  outputs: Record<string, BatchItemExport>;
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

  trimPreviews() {
    const selectedPreview = Object.values(this.batch.previews).find(
      (item) => !item.failed
    );
    if (selectedPreview) {
      const trimmedPreview = <Record<string, BatchItemPreview>>{};
      trimmedPreview[selectedPreview.blendId] = selectedPreview;
      this.batch.previews = trimmedPreview;
    }
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
