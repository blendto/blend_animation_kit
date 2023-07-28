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
import ReferralService from "server/service/referral";
import SubscriptionService from "server/service/subscription";
import { RecipeService } from "server/service/recipe";
import InterServiceAuth from "server/internal/inter-service-auth";
import Firebase from "server/external/firebase";
import { Repo } from "server/repositories/base";
import { User } from "server/base/models/user";
import { UserDynamooseRepo } from "server/repositories/user";
import {
  ReferralDynamooseRepo,
  ReferralEntity,
} from "server/repositories/referral";
import { AnalyticsDynamooseRepo } from "server/repositories/analytics";
import { Analytics } from "server/base/models/analytics";
import { NewAnalyticsService } from "server/service/newAnalytics";
import { DaxDB } from "server/external/dax";
import FileKeysService from "server/service/fileKeys";
import { CreditsService } from "server/service/credits";
import AppleService from "server/external/apple";
import {
  UserAccountActionQueue,
  UserAccountActionSqsConfig,
} from "server/external/queue/userAccountActionQueue";
import { AIStudioService } from "server/service/aistudio";
import {
  BrandingDynamooseRepo,
  BrandingEntity,
} from "server/repositories/branding";
import { BrandingRecipe } from "server/base/models/brandingRecipe";
import { BrandingRecipeDynamooseRepo } from "server/repositories/brandingRecipe";
import {
  NonHeroRecipeListDynamooseRepo,
  NonHeroRecipeListEntity,
} from "server/repositories/nonHeroRecipeList";
import { NonHeroRecipeListService } from "server/service/nonHeroRecipeList";
import ConfigService from "server/service/config";
import { PreviewService } from "server/service/preview";
import { BatchV2Service } from "server/service/batch-v2";
import CatalogueServiceApi from "server/internal/catalogue-service-api";
import { ProjectsFrictionService } from "server/service/projects-friction-service";
import { P2DCreationLogRepository } from "server/repositories/p2d-creation-log";

const diContainer = new Container();

diContainer.bind<DynamoDB>(TYPES.DynamoDB).to(DynamoDB).inSingletonScope();
diContainer.bind<DaxDB>(TYPES.DaxDB).to(DaxDB).inSingletonScope();
diContainer
  .bind<BatchService>(TYPES.BatchService)
  .to(BatchService)
  .inSingletonScope();
diContainer
  .bind<BatchV2Service>(TYPES.BatchV2Service)
  .to(BatchV2Service)
  .inSingletonScope();
diContainer
  .bind<BlendService>(TYPES.BlendService)
  .to(BlendService)
  .inSingletonScope();
diContainer
  .bind<ProjectsFrictionService>(TYPES.ProjectsFrictionService)
  .to(ProjectsFrictionService)
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
  .bind<CatalogueServiceApi>(TYPES.CatalogueServiceApi)
  .to(CatalogueServiceApi)
  .inSingletonScope();
diContainer
  .bind<BatchActionService>(TYPES.BatchActionService)
  .to(BatchActionService)
  .inSingletonScope();
diContainer
  .bind<ConfigService>(TYPES.ConfigService)
  .to(ConfigService)
  .inSingletonScope();
diContainer
  .bind<PreviewService>(TYPES.PreviewService)
  .to(PreviewService)
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
  .bind<UserAccountActionQueue<QueueConfig>>(TYPES.UserAccountActionQueue)
  .toDynamicValue(
    () =>
      new UserAccountActionQueue<UserAccountActionSqsConfig>(
        new SqsProvider(),
        new UserAccountActionSqsConfig()
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
  .bind<ReferralService>(TYPES.ReferralService)
  .to(ReferralService)
  .inSingletonScope();
diContainer
  .bind<SubscriptionService>(TYPES.SubscriptionService)
  .to(SubscriptionService)
  .inSingletonScope();
diContainer
  .bind<RecipeService>(TYPES.RecipeService)
  .to(RecipeService)
  .inSingletonScope();
diContainer
  .bind<NonHeroRecipeListService>(TYPES.NonHeroRecipeListService)
  .to(NonHeroRecipeListService)
  .inSingletonScope();
diContainer
  .bind<InterServiceAuth>(TYPES.InterServiceAuth)
  .to(InterServiceAuth)
  .inSingletonScope();
diContainer.bind<Firebase>(TYPES.Firebase).to(Firebase).inSingletonScope();
diContainer
  .bind<Repo<BrandingEntity>>(TYPES.BrandingRepo)
  .toDynamicValue(() => new BrandingDynamooseRepo());
diContainer
  .bind<Repo<NonHeroRecipeListEntity>>(TYPES.NonHeroRecipeListRepo)
  .toDynamicValue(() => new NonHeroRecipeListDynamooseRepo());
diContainer
  .bind<Repo<BrandingRecipe>>(TYPES.BrandingRecipeRepo)
  .toDynamicValue(() => new BrandingRecipeDynamooseRepo());
diContainer
  .bind<Repo<User>>(TYPES.UserRepo)
  .toDynamicValue(() => new UserDynamooseRepo());
diContainer
  .bind<Repo<ReferralEntity>>(TYPES.ReferralRepo)
  .toDynamicValue(() => new ReferralDynamooseRepo());
diContainer
  .bind<Repo<Analytics>>(TYPES.AnalyticsRepo)
  .toDynamicValue(() => new AnalyticsDynamooseRepo());
diContainer
  .bind<AppleService>(TYPES.AppleService)
  .toDynamicValue(() => new AppleService());
diContainer
  .bind<NewAnalyticsService>(TYPES.AnalyticsService)
  .to(NewAnalyticsService)
  .inSingletonScope();
diContainer
  .bind<FileKeysService>(TYPES.FileKeysService)
  .to(FileKeysService)
  .inSingletonScope();
diContainer
  .bind<CreditsService>(TYPES.CreditsService)
  .to(CreditsService)
  .inSingletonScope();
diContainer
  .bind<AIStudioService>(TYPES.AIStudioService)
  .to(AIStudioService)
  .inSingletonScope();
diContainer
  .bind<P2DCreationLogRepository>(TYPES.P2DCreationLogRepo)
  .to(P2DCreationLogRepository)
  .inSingletonScope();
export { diContainer };
