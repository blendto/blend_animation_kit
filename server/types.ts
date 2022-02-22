import { BatchService } from "server/service/batch";
import DynamoDB from "server/external/dynamodb";
import { BlendService } from "server/service/blend";
import { UploadService } from "server/service/upload";
import { UserService } from "server/service/user";

export const TYPES = {
  DynamoDB: Symbol.for("DynamoDB"),
  BatchService: Symbol.for("BatchService"),
  BlendService: Symbol.for("BlendService"),
  UploadService: Symbol.for("UploadService"),
  UserService: Symbol.for("UserService"),
};
