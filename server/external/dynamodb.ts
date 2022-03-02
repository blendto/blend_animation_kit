import "reflect-metadata";
import AWS from "./aws";
import { IDataStore } from "./datastore";
import { injectable } from "inversify";
import logger from "server/base/Logger";

var docClient = new AWS.DynamoDB.DocumentClient();

@injectable()
export default class DynamoDB implements IDataStore {
  private static _instance: DynamoDB = new DynamoDB();

  static _(): DynamoDB {
    return DynamoDB._instance;
  }

  scanItems(
    params: AWS.DynamoDB.DocumentClient.ScanInput
  ): Promise<AWS.DynamoDB.DocumentClient.ItemList> {
    return new Promise((resolve, reject) => {
      docClient.scan(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data.Items);
      });
    });
  }

  queryItems(
    params: AWS.DynamoDB.DocumentClient.QueryInput
  ): Promise<AWS.DynamoDB.DocumentClient.QueryOutput> {
    return new Promise((resolve, reject) => {
      docClient.query(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  getItem(
    params: AWS.DynamoDB.DocumentClient.GetItemInput
  ): Promise<AWS.DynamoDB.DocumentClient.AttributeMap> {
    return new Promise((resolve, reject) => {
      docClient.get(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data.Item);
      });
    });
  }

  putItem(
    params: AWS.DynamoDB.DocumentClient.PutItemInput
  ): Promise<AWS.DynamoDB.DocumentClient.PutItemOutput> {
    return new Promise((resolve, reject) => {
      docClient.put(params, (err, data) => {
        if (err) {
          logger.error(err);
          // We expect an error coz document wont exist if unique
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  deleteItem(
    params: AWS.DynamoDB.DocumentClient.DeleteItemInput
  ): Promise<AWS.DynamoDB.DocumentClient.DeleteItemOutput> {
    return new Promise((resolve, reject) => {
      docClient.delete(params, (err, data) => {
        if (err) {
          logger.error(err);
          // We expect an error coz document wont exist if unique
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  updateItem(
    params: AWS.DynamoDB.DocumentClient.UpdateItemInput
  ): Promise<AWS.DynamoDB.DocumentClient.UpdateItemOutput> {
    return new Promise((resolve, reject) => {
      docClient.update(params, (err, data) => {
        if (err) {
          logger.error(err);
          // We expect an error coz document wont exist if unique
          return reject(err);
        }
        resolve(data);
      });
    });
  }
}
