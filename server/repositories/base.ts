import {
  aws,
  model as dynamooseModel,
  Schema as DynamooseSchema,
} from "dynamoose";
import { Document as DynamooseEntity } from "dynamoose/dist/Document";
import { Model as DynamooseModel } from "dynamoose/dist/Model";
import { get, set } from "lodash";
import { nanoid } from "nanoid";

import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import { getCredentials } from "server/external/aws";

const { sdk } = aws;
// Vercel envs have their own AWS config as default. Explicitly pick up our's
sdk.config.update({
  credentials: getCredentials(),
  region: ConfigProvider.AWS_CLOUD_REGION,
});

type KeyObject = {
  [attribute: string]: string | number;
};

export type JSONPatch = {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
}[];

export interface Entity {}

export abstract class Repo<ExtendedEntity extends Entity> {
  abstract create?(params: Partial<ExtendedEntity>): Promise<ExtendedEntity>;
  abstract createWithoutSurrogateKey?(
    params: Partial<ExtendedEntity>
  ): Promise<ExtendedEntity>;
  abstract get?(keyObject: KeyObject): Promise<ExtendedEntity | void>;
  abstract query?(params: Partial<ExtendedEntity>): Promise<ExtendedEntity[]>;
  abstract update?(
    keyObject: KeyObject,
    jsonPatch: JSONPatch,
    currentData?: ExtendedEntity
  ): Promise<ExtendedEntity>;
  abstract delete?(keyObject: KeyObject): Promise<void>;
}

export class DynamooseRepo<
  ExtendedEntity extends Entity,
  DynamooseExtendedEntity extends DynamooseEntity
> implements Repo<ExtendedEntity>
{
  model: DynamooseModel<DynamooseExtendedEntity>;

  static generateId(size = 8): string {
    return nanoid(size);
  }

  async create(params: Partial<ExtendedEntity>): Promise<ExtendedEntity> {
    const id = DynamooseRepo.generateId();
    try {
      return (await this.model.create({
        id,
        ...params,
      } as unknown as Partial<DynamooseExtendedEntity>)) as unknown as ExtendedEntity;
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err.code === "ConditionalCheckFailedException") {
        // Generated id already exists. Re-generate.
        return await this.create(params);
      }
      throw err;
    }
  }

  async createWithoutSurrogateKey(
    params: Partial<ExtendedEntity>
  ): Promise<ExtendedEntity> {
    return (await this.model.create(
      params as unknown as Partial<DynamooseExtendedEntity>
    )) as unknown as ExtendedEntity;
  }

  async get(keyObject: KeyObject): Promise<ExtendedEntity | void> {
    return (await this.model.get(keyObject)) as unknown as ExtendedEntity;
  }

  async query(params: Partial<ExtendedEntity>): Promise<ExtendedEntity[]> {
    return (await this.model
      .query(params as unknown as Partial<DynamooseExtendedEntity>)
      .exec()) as unknown as ExtendedEntity[];
  }

  async update(
    keyObject: KeyObject,
    jsonPatch: JSONPatch,
    currentData?: ExtendedEntity
  ): Promise<ExtendedEntity> {
    const updateSet = { $SET: {}, $REMOVE: [] };
    if (
      !currentData &&
      // Fetch current data only if there is a nested update
      jsonPatch.find((change) => change.path.slice(1).includes("/"))
    ) {
      currentData = (await this.get(keyObject)) as ExtendedEntity;
      if (!currentData) {
        throw new UserError("Invalid keyObject");
      }
    }
    jsonPatch.forEach((change) => {
      // Remove the first slash. Eg: "/logos" => "logos"
      let key = change.path.slice(1);
      // Replace the other slashes with dot notation.
      // Eg: "logos/primaryEntry" => "logos.primaryEntry"
      key = key.replace("/", ".");

      let { value } = change;
      // dynamoose doesn't allow nested update on maps. Pass whole maps instead.
      // See https://github.com/dynamoose/dynamoose/issues/665
      if (key.includes(".")) {
        const keySplit = key.split(".");
        const nestedValue = value;
        key = keySplit[0];
        value = get(currentData, keySplit[0]);
        set(value as object, keySplit.slice(1).join("."), nestedValue);
      }

      if (["add", "replace"].includes(change.op)) {
        updateSet.$SET[key] = value;
      } else {
        updateSet.$REMOVE.push(key);
      }
    });
    return (await this.model.update(
      keyObject,
      updateSet as unknown as Partial<DynamooseExtendedEntity>
    )) as unknown as ExtendedEntity;
  }

  async delete(keyObject: KeyObject): Promise<void> {
    await this.model.delete(keyObject);
  }
}

export { DynamooseModel, DynamooseSchema, dynamooseModel, DynamooseEntity };
