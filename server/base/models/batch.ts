import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";

// eslint-disable-next-line no-shadow
export enum BatchState {
  IDLE = "IDLE",
  PROCESSING = "PROCESSING",
  GENERATING = "GENERATING",
  GENERATED = "GENERATED",
  DELETED = "DELETED",
}

export interface UploadRequestCreationConfig {
  fileNames: string[];
}

export interface UploadRequest {
  fileName: string;
  blendId: string;
  fileKey: string;
  presignedUploadRequest: PresignedPost;
}

export interface UploadRequests {
  uploadRequests: UploadRequest[];
}

export interface Batch {
  id: string;
  status: BatchState;
  blends: string[];
  pendingUploads: Record<string, UploadRequest>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputs: any[];
}

export class BatchModelValidators {
  static validateRequestConfig(request: UploadRequestCreationConfig): boolean {
    if (!request.fileNames) {
      return false;
    }
    return (
      request.fileNames.length > 0 &&
      request.fileNames.length <= 20 &&
      request.fileNames.length === new Set(request.fileNames).size
    );
  }
}
