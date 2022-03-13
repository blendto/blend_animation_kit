import { Container } from "inversify";
import { TYPES } from "server/types";
import DynamoDB from "server/external/dynamodb";
import { BatchService } from "server/service/batch";
import { BlendService } from "server/service/blend";
import { UploadService } from "server/service/queue/upload";
import { UserService } from "server/service/user";
import { BatchActionService } from "server/service/queue/batch/batchAction";
import {
  BatchTaskQueue,
  BatchTaskSqsConfig,
} from "server/external/queue/batchTaskQueue";
import { QueueConfig } from "server/external/queue";
import { SuggestionService } from "server/service/suggestion";
import HeroImageService from "server/service/heroImage";
import { SqsProvider } from "server/external/queue/sqs";
import {
  BlendImageUploadEventQueue,
  BlendImageUploadSqsConfig,
} from "server/external/queue/blendImageUploadQueue";
import { RemoveBgService } from "server/internal/remove-bg-service";
import BrandingService from "server/service/branding";
import { RecipeService } from "server/service/recipe";
import InterServiceAuth from "server/internal/inter-service-auth";

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
  .bind<BatchActionService>(TYPES.BatchActionService)
  .to(BatchActionService)
  .inSingletonScope();
diContainer
  .bind<BatchTaskQueue<QueueConfig>>(TYPES.BatchTaskQueue)
  .toDynamicValue(
    () =>
      new BatchTaskQueue<BatchTaskSqsConfig>(
        new SqsProvider(),
        new BatchTaskSqsConfig()
      )
  );
diContainer
  .bind<SuggestionService>(TYPES.SuggestionService)
  .to(SuggestionService)
  .inSingletonScope();
diContainer
  .bind<HeroImageService>(TYPES.HeroImageService)
  .to(HeroImageService)
  .inSingletonScope();
diContainer
  .bind<BlendImageUploadEventQueue<QueueConfig>>(
    TYPES.BlendImageUploadEventQueue
  )
  .toDynamicValue(
    () =>
      new BlendImageUploadEventQueue<BlendImageUploadSqsConfig>(
        new SqsProvider(),
        new BlendImageUploadSqsConfig()
      )
  );
diContainer
  .bind<RemoveBgService>(TYPES.RemoveBgService)
  .to(RemoveBgService)
  .inSingletonScope();
diContainer
  .bind<BrandingService>(TYPES.BrandingService)
  .to(BrandingService)
  .inSingletonScope();
diContainer
  .bind<RecipeService>(TYPES.RecipeService)
  .to(RecipeService)
  .inSingletonScope();
diContainer
  .bind<InterServiceAuth>(TYPES.InterServiceAuth)
  .to(InterServiceAuth)
  .inSingletonScope();
// eslint-disable-next-line import/prefer-default-export
export { diContainer };
