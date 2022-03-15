import { QueueMessage } from "server/external/queue";

export interface BatchTaskMessage extends QueueMessage {
  batchId: string;
  blendId: string;
  type: BatchTaskType;
}

export enum BatchTaskType {
  process_upload = "PROCESS_UPLOAD",
  process_operations = "PROCESS_OPERATIONS",
}

export interface ImageUploadMessage extends QueueMessage {
  Records: {
    s3: {
      bucket: {
        name: string;
      };
      object: {
        key: string;
      };
    };
  }[];
}
