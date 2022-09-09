/* eslint-disable
  dot-notation,
  @typescript-eslint/no-unsafe-call,
  @typescript-eslint/no-unsafe-return,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-assignment,
  class-methods-use-this
*/
import { ServiceAccount } from "firebase-admin";

import { EnvironmentVarsSchema } from "./EnvironmentVarsSchema";

class ConfigProvider {
  constructor() {
    if (typeof window === "undefined") {
      // Run only in server
      const result = EnvironmentVarsSchema.validate(process.env);
      if (result.error) {
        throw new Error(result.error.message);
      }
    }
  }

  public get APPLE_TEAM_ID(): string {
    return this.retrieveOrCrash("APPLE_TEAM_ID");
  }

  public get APPLE_APP_ID(): string {
    return this.retrieveOrCrash("APPLE_APP_ID");
  }

  public get APPLE_KEY_ID(): string {
    return this.retrieveOrCrash("APPLE_KEY_ID");
  }

  public get APPLE_AUTH_KEY(): string {
    return this.retrieveOrCrash("APPLE_AUTH_KEY");
  }

  public get BATCH_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("BATCH_DYNAMODB_TABLE");
  }

  public get CONFIG_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("CONFIG_DYNAMODB_TABLE");
  }

  public get BLEND_VERSIONED_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("BLEND_VERSIONED_DYNAMODB_TABLE");
  }

  public get BLEND_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("BLEND_DYNAMODB_TABLE");
  }

  public get BLEND_GEN_QUEUE_URL(): string {
    return this.retrieveOrCrash("BLEND_GEN_QUEUE_URL");
  }

  public get BLEND_INGREDIENTS_BUCKET(): string {
    return this.retrieveOrCrash("BLEND_INGREDIENTS_BUCKET");
  }

  public get BLEND_OUTPUT_BUCKET(): string {
    return this.retrieveOrCrash("BLEND_OUTPUT_BUCKET");
  }

  public get HERO_IMAGES_BUCKET(): string {
    return this.retrieveOrCrash("HERO_IMAGES_BUCKET");
  }

  public get RECIPE_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("RECIPE_DYNAMODB_TABLE");
  }

  public get USER_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("USER_DYNAMODB_TABLE");
  }

  public get REFERRAL_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("REFERRAL_DYNAMODB_TABLE");
  }

  public get ANALYTICS_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("ANALYTICS_DYNAMODB_TABLE");
  }

  public get RECIPE_INGREDIENTS_BUCKET(): string {
    return this.retrieveOrCrash("RECIPE_INGREDIENTS_BUCKET");
  }

  public get WEB_USER_ASSETS_BUCKET(): string {
    return this.retrieveOrCrash("WEB_USER_ASSETS_BUCKET");
  }

  public get OUTPUT_BASE_PATH(): string {
    // Can't use retrieveOrCrash fn. because variables starting with "NEXT_PUBLIC_" are removed
    // from process.env by nextjs during build, replacing their usages with the values instead.
    return process.env.NEXT_PUBLIC_OUTPUT_BASE_PATH;
  }

  public get TOOLKIT_BASE_PATH(): string {
    return this.retrieveOrCrash("TOOLKIT_BASE_PATH");
  }

  public get VES_API_BASE_PATH(): string {
    return this.retrieveOrCrash("VES_API_BASE_PATH");
  }

  public get RECO_API_BASE_PATH(): string {
    return this.retrieveOrCrash("RECO_ENGINE_BASE_URL");
  }

  public get FIREBASE_SERVICE_KEY(): ServiceAccount {
    let parsedKey = JSON.parse(this.retrieveOrCrash("FIREBASE_SERVICE_KEY"));
    parsedKey = {
      ...parsedKey,
      private_key: parsedKey["private_key"].replace(/\\n/g, "\n"),
    };
    return parsedKey;
  }

  public get FIREBASE_APP_CLIENT_CONFIG(): Record<string, unknown> {
    // Refer OUTPUT_BASE_PATH fn. to see why retrieveOrCrash fn. can't be used here
    return JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_APP_CLIENT_CONFIG);
  }

  public get SELF_BASE_PATH(): string {
    // Refer OUTPUT_BASE_PATH fn. to see why retrieveOrCrash fn. can't be used here
    return process.env.NEXT_PUBLIC_SELF_BASE_PATH;
  }

  public get IPAPI_ACCESS_KEY(): string {
    return this.retrieveOrCrash("IPAPI_ACCESS_KEY");
  }

  public get HERO_IMAGES_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("HERO_IMAGES_DYNAMODB_TABLE");
  }

  public get AWS_CLOUD_ACCESS_KEY_ID(): string {
    // Optional, only needed in vercel, others will take the machine settings
    return process.env.AWS_CLOUD_ACCESS_KEY_ID;
  }

  public get AWS_CLOUD_SECRET_ACCESS_KEY(): string {
    // Optional, only needed in vercel, others will take the machine settings
    return process.env.AWS_CLOUD_SECRET_ACCESS_KEY;
  }

  public get AWS_CLOUD_REGION(): string {
    // Optional, only needed in vercel, others will take the machine settings
    return process.env.AWS_CLOUD_REGION;
  }

  public get DAX_WEB_CLIENT_CACHE(): string {
    return process.env.DAX_WEB_CLIENT_CACHE;
  }

  public get BATCH_TASK_QUEUE_URL(): string {
    return process.env.BATCH_TASK_QUEUE_URL;
  }

  public get USER_ACCOUNT_ACTION_QUEUE_URL(): string {
    return this.retrieveOrCrash("USER_ACCOUNT_ACTION_QUEUE_URL");
  }

  public get UPLOADS_EVENT_QUEUE_URL(): string {
    return process.env.BLEND_UPLOADS_EVENT_QUEUE_URL;
  }

  public get BG_REMOVER_BASE_PATH(): string {
    return process.env.BG_REMOVER_BASE_PATH;
  }

  public get BG_REMOVER_API_KEY(): string {
    return process.env.BG_REMOVER_API_KEY;
  }

  public get BG_REMOVAL_LOG_TABLE_NAME(): string {
    return process.env.BG_REMOVAL_LOG_TABLE_NAME;
  }

  public get BRANDING_DYNAMODB_TABLE(): string {
    return this.retrieveOrCrash("BRANDING_DYNAMODB_TABLE");
  }

  public get BRANDING_DYNAMODB_USER_ID_INDEX(): string {
    return this.retrieveOrCrash("BRANDING_DYNAMODB_USER_ID_INDEX");
  }

  public get BRANDING_BUCKET(): string {
    return this.retrieveOrCrash("BRANDING_BUCKET");
  }

  public get SERVICE_API_KEYS_SECRET_ARN(): string {
    return process.env.SERVICE_API_KEYS_SECRET_ARN;
  }

  public get REVENUECAT_API_BASE_PATH(): string {
    return this.retrieveOrCrash("REVENUECAT_API_BASE_PATH");
  }

  public get REVENUECAT_API_KEY(): string {
    return this.retrieveOrCrash("REVENUECAT_API_KEY");
  }

  public get CREDIT_SERVICE_BASE_PATH(): string {
    return this.retrieveOrCrash("CREDIT_SERVICE_BASE_PATH");
  }

  public get CREDIT_SERVICE_API_KEY(): string {
    return this.retrieveOrCrash("CREDIT_SERVICE_API_KEY");
  }

  public get CREDIT_SERVICE_PLAN_ID(): string {
    return this.retrieveOrCrash("CREDIT_SERVICE_PLAN_ID");
  }

  public get CREDIT_SERVICE_EXPORT_TRANSACTION_TYPE_ID(): string {
    return this.retrieveOrCrash("CREDIT_SERVICE_EXPORT_TRANSACTION_TYPE_ID");
  }

  public get REVENUECAT_CREDIT_OFFERINGS(): Record<string, number> {
    return JSON.parse(this.retrieveOrCrash("REVENUECAT_CREDIT_OFFERINGS"));
  }

  public get FAILED_WEBHOOK_CALLS_TABLE(): string {
    return this.retrieveOrCrash("FAILED_WEBHOOK_CALLS_TABLE");
  }

  public get LOG_LEVEL(): string {
    return process.env.LOG_LEVEL ?? "info";
  }

  public get CLEVERTAP_ACCOUNT_ID(): string {
    return this.retrieveOrCrash("CLEVERTAP_ACCOUNT_ID");
  }

  public get CLEVERTAP_PASSCODE(): string {
    return this.retrieveOrCrash("CLEVERTAP_PASSCODE");
  }

  public get WATERMARK_BUILD_VERSION(): number {
    const versionStr = process.env.WATERMARK_BUILD_VERSION;
    const version = parseInt(versionStr, 10);
    // eslint-disable-next-line no-restricted-globals
    if (isNaN(version)) {
      return null;
    }
    return version;
  }

  private retrieveOrCrash(envVar: string): string {
    const variable = process.env[envVar];
    if (!variable || variable.trim().length === 0) {
      throw new Error(`envVar ${envVar} not set!`);
    }
    return variable;
  }
}

export default new ConfigProvider();
