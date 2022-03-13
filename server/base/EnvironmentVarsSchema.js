const Joi = require("joi");

module.exports = {
  EnvironmentVarsSchema: Joi.object()
    .keys({
      NEXT_PUBLIC_SELF_BASE_PATH: Joi.string().required(),
      RECIPE_DYNAMODB_TABLE: Joi.string().required(),
      RECIPE_LISTS_DYNAMODB_TABLE: Joi.string().required(),
      CONFIG_DYNAMODB_TABLE: Joi.string().required(),
      BLEND_DYNAMODB_TABLE: Joi.string().required(),
      BLEND_VERSIONED_DYNAMODB_TABLE: Joi.string().required(),
      BLEND_GEN_QUEUE_URL: Joi.string().required(),
      BLEND_INGREDIENTS_BUCKET: Joi.string().required(),
      RECIPE_INGREDIENTS_BUCKET: Joi.string().required(),
      WEB_USER_ASSETS_BUCKET: Joi.string().required(),
      NEXT_PUBLIC_OUTPUT_BASE_PATH: Joi.string().required(),
      TOOLKIT_BASE_PATH: Joi.string().required(),
      VES_API_BASE_PATH: Joi.string().required(),
      RECO_ENGINE_BASE_URL: Joi.string().required(),
      FIREBASE_SERVICE_KEY: Joi.string().required(),
      IPAPI_ACCESS_KEY: Joi.string().required(),
      HERO_IMAGES_BUCKET: Joi.string().required(),
      BLEND_OUTPUT_BUCKET: Joi.string().required(),
      HERO_IMAGES_DYNAMODB_TABLE: Joi.string().required(),
      BATCH_DYNAMODB_TABLE: Joi.string().required(),
      NEXT_PUBLIC_FIREBASE_APP_CLIENT_CONFIG: Joi.string().required(),
      BATCH_TASK_QUEUE_URL: Joi.string().required(),
      BLEND_UPLOADS_EVENT_QUEUE_URL: Joi.string().required(),
      BG_REMOVER_BASE_PATH: Joi.string().required(),
      BG_REMOVER_API_KEY: Joi.string().required(),
      BG_REMOVAL_LOG_TABLE_NAME: Joi.string().required(),
      BRANDING_DYNAMODB_TABLE: Joi.string().required(),
      BRANDING_DYNAMODB_USER_ID_INDEX: Joi.string().required(),
      SERVICE_API_KEYS_SECRET_ARN: Joi.string().required(),
    })
    .unknown(true),
};
