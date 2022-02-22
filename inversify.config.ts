import { Container } from "inversify";
import { TYPES } from "server/types";
import DynamoDB from "server/external/dynamodb";
import { BatchService } from "server/service/batch";
import { BlendService } from "server/service/blend";
import { UploadService } from "server/service/upload";
import { UserService } from "server/service/user";

const diContainer = new Container();
diContainer.bind<DynamoDB>(TYPES.DynamoDB).to(DynamoDB);
diContainer.bind<BatchService>(TYPES.BatchService).to(BatchService);
diContainer.bind<BlendService>(TYPES.BlendService).to(BlendService);
diContainer.bind<UploadService>(TYPES.UploadService).to(UploadService);
diContainer.bind<UserService>(TYPES.UserService).to(UserService);
export { diContainer };
