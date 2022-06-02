import "reflect-metadata";
import { injectable } from "inversify";
import { DocumentClient } from "aws-sdk/lib/dynamodb/document_client";
import AmazonDaxClient from "amazon-dax-client";
import DynamoDB from "server/external/dynamodb";
import ConfigProvider from "server/base/ConfigProvider";
import AWS from "./aws";

@injectable()
export class DaxDB extends DynamoDB {
  daxClient: DocumentClient;

  constructor() {
    super();
    const service = new AmazonDaxClient({
      endpoints: [ConfigProvider.DAX_WEB_CLIENT_CACHE],
      region: ConfigProvider.AWS_CLOUD_REGION,
    });

    //  eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //  @ts-ignore
    this.daxClient = new AWS.DynamoDB.DocumentClient({ service });
  }

  getClient(): DocumentClient {
    return this.daxClient;
  }
}
