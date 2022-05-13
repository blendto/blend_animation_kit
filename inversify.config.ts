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
  ImageUploadEventQueue,
  ImageUploadSqsConfig,
} from "server/external/queue/imageUploadQueue";
import { RemoveBgService } from "server/internal/remove-bg-service";
import BrandingService from "server/service/branding";
import { RecipeService } from "server/service/recipe";
import InterServiceAuth from "server/internal/inter-service-auth";
import Firebase from "server/external/firebase";
import { Repo } from "server/repositories/base";
import { User } from "server/base/models/user";
import { UserDynamooseRepo } from "server/repositories/user";
import { AnalyticsDynamooseRepo } from "server/repositories/analytics";
import { Analytics } from "server/base/models/analytics";
import { NewAnalyticsService } from "server/service/newAnalytics";

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
  .bind<ImageUploadEventQueue<QueueConfig>>(TYPES.ImageUploadEventQueue)
  .toDynamicValue(
    () =>
      new ImageUploadEventQueue<ImageUploadSqsConfig>(
        new SqsProvider(),
        new ImageUploadSqsConfig()
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
diContainer.bind<Firebase>(TYPES.Firebase).to(Firebase).inSingletonScope();
diContainer
  .bind<Repo<User>>(TYPES.UserRepo)
  .toDynamicValue(() => new UserDynamooseRepo());
diContainer
  .bind<Repo<Analytics>>(TYPES.AnalyticsRepo)
  .toDynamicValue(() => new AnalyticsDynamooseRepo());
diContainer
  .bind<NewAnalyticsService>(TYPES.AnalyticsService)
  .to(NewAnalyticsService)
  .inSingletonScope();
export { diContainer };
