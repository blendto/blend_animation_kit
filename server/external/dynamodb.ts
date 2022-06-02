import "reflect-metadata";
import { injectable } from "inversify";
import logger from "server/base/Logger";
import { DocumentClient } from "aws-sdk/lib/dynamodb/document_client";
import { IDataStore } from "./datastore";
import AWS from "./aws";

const docClient = new AWS.DynamoDB.DocumentClient();

@injectable()
export default class DynamoDB implements IDataStore {
  private static instance: DynamoDB = new DynamoDB();

  static _(): DynamoDB {
    return DynamoDB.instance;
  }

  getClient(): DocumentClient {
    return docClient;
  }

  scanItems(
    params: AWS.DynamoDB.DocumentClient.ScanInput
  ): Promise<AWS.DynamoDB.DocumentClient.ItemList> {
    return new Promise((resolve, reject) => {
      this.getClient().scan(params, (err, data) => {
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
      this.getClient().query(params, (err, data) => {
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
      this.getClient().get(params, (err, data) => {
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
      this.getClient().put(params, (err, data) => {
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
      this.getClient().delete(params, (err, data) => {
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
      this.getClient().update(params, (err, data) => {
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
