import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { injectable } from "inversify";
import _ from "lodash";
import ConfigProvider from "server/base/ConfigProvider";
import { UnauthorizedError } from "server/base/errors";
import { IService } from "server/service";
import NodeCache from "node-cache";
import { getCredentials } from "server/external/aws";

export enum BlendMicroServices {
  AWSTriggerHandlers = "AWSTriggerHandlers",
}

@injectable()
export default class InterServiceAuth implements IService {
  apiKeysCache = new NodeCache({ stdTTL: 60 /* 60 seconds */ });

  setCache(apiKeys: Object) {
    this.apiKeysCache.set("secrets", apiKeys);
  }

  async retrieveApiKeysFromSecretsManager() {
    const secretsManagerClient = new SecretsManagerClient({
      credentials: getCredentials(),
      region: process.env.AWS_CLOUD_REGION,
    });

    const getSecretCommand = new GetSecretValueCommand({
      SecretId: ConfigProvider.SERVICE_API_KEYS_SECRET_ARN,
    });

    const secret = await secretsManagerClient.send(getSecretCommand);

    const deserializedSecrets = JSON.parse(secret.SecretString!);

    return deserializedSecrets;
  }

  async fetchApiKeys() {
    let apiKeys: Object = this.apiKeysCache.get("secrets");

    if (!apiKeys) {
      apiKeys = await this.retrieveApiKeysFromSecretsManager();

      this.setCache(apiKeys);
    }

    return apiKeys;
  }

  async getToken(serviceType: BlendMicroServices): Promise<string> {
    const apiKeys = await this.fetchApiKeys();

    const apiKeyForService = apiKeys[serviceType];

    if (_.isNil(apiKeyForService)) {
      throw Error("API Key for Service not found");
    }

    return apiKeyForService;
  }

  async validate(
    serviceType: BlendMicroServices,
    token?: string
  ): Promise<void> {
    if (!token) {
      throw new UnauthorizedError("Expected Service Auth");
    }

    const apiKeyForService = await this.getToken(serviceType);

    if (apiKeyForService !== token) {
      throw new UnauthorizedError("Invalid Service Auth");
    }

    return;
  }
}
