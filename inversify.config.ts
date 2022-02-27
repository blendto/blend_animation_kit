import { Container } from "inversify";
import { TYPES } from "server/types";
import DynamoDB from "server/external/dynamodb";
import { BatchService } from "server/service/batch";
import { BlendService } from "server/service/blend";
import { UploadService } from "server/service/upload";
import { UserService } from "server/service/user";
import { SuggestionService } from "server/service/suggestion";
import HeroImageService from "server/service/heroImage";
import { RemoveBgService } from "server/internal/remove-bg-service";

const diContainer = new Container();
diContainer.bind<DynamoDB>(TYPES.DynamoDB).to(DynamoDB).inSingletonScope();
diContainer
  .bind<BatchService>(TYPES.BatchService)
  .to(BatchService)
  .inSingletonScope();
diContainer
  .bind<BlendService>(TYPES.BlendService)
  .to(BlendService)
  .inSingletonScope();
diContainer
  .bind<UploadService>(TYPES.UploadService)
  .to(UploadService)
  .inSingletonScope();
diContainer
  .bind<UserService>(TYPES.UserService)
  .to(UserService)
  .inSingletonScope();
diContainer
  .bind<SuggestionService>(TYPES.SuggestionService)
  .to(SuggestionService)
  .inSingletonScope();
diContainer
  .bind<HeroImageService>(TYPES.HeroImageService)
  .to(HeroImageService)
  .inSingletonScope();
diContainer
  .bind<RemoveBgService>(TYPES.RemoveBgService)
  .to(RemoveBgService)
  .inSingletonScope();
export { diContainer };
