import * as dynamoose from "dynamoose";
import ConfigProvider from "server/base/ConfigProvider";
import { getCredentials } from "server/external/aws";

const { sdk } = dynamoose.aws;
// Vercel envs have their own AWS config as default. Explicitly pick up our's
sdk.config.update({
  credentials: getCredentials(),
  region: ConfigProvider.AWS_CLOUD_REGION,
});

export { Schema, model } from "dynamoose";
export { Model } from "dynamoose/dist/Model";
export { Document } from "dynamoose/dist/Document";
