import { BlendService } from "server/service/blend";
import { UserService } from "server/service/user";
import DynamoDB from "server/external/dynamodb";
import HeroImageService from "server/service/heroImage";
import { BatchService } from "server/service/batch";
import { UploadService } from "server/service/upload";
import { ServerError } from "server/base/errors";

export interface IService {}

export abstract class IServiceLocator {
  abstract find<T extends IService>(_constructor: { new (...args): T }): T;
}

export class DynamoBasedServiceLocator implements IServiceLocator {
  private _services: Record<string, IService> = {};

  static instance = new DynamoBasedServiceLocator(DynamoDB._());

  constructor(dynamoDb: DynamoDB) {
    this._services[BlendService.name] = new BlendService(dynamoDb);
    this._services[BatchService.name] = new BatchService(dynamoDb);
    this._services[UserService.name] = new UserService(dynamoDb, this);
    this._services[UploadService.name] = new UploadService(dynamoDb, this);
    this._services[HeroImageService.name] = new HeroImageService(
      dynamoDb,
      this
    );
  }

  find<T extends IService>(_constructor: { new (...args): T }): T {
    const service = this._services[_constructor.name];
    if (!service) {
      throw new ServerError(
        `Unable to resolve service with name: ${_constructor.name}`
      );
    }
    return service as T;
  }
}
