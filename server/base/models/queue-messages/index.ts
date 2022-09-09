import { QueueMessage } from "server/external/queue";

export interface BatchTaskMessage extends QueueMessage {
  batchId: string;
  blendId: string;
  type: BatchTaskType;
}

export enum BatchTaskType {
  process_upload = "PROCESS_UPLOAD",
  process_operations = "PROCESS_OPERATIONS",
  process_export = "PROCESS_EXPORT",
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

export enum UserAccountActionType {
  DELETE = "DELETE",
}

export interface UserAccountActionMessage extends QueueMessage {
  action: UserAccountActionType;
  userId: string;
}
