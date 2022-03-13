import { nanoid } from "nanoid";
import { Document, Model } from "server/models/object-data-mapper";

export default class ModelHelper {
  static generateId(size = 8): string {
    return nanoid(size);
  }

  static async createWithId<ExtendedDocument extends Document>(
    modelInstance: Model<ExtendedDocument>,
    params
  ): Promise<ExtendedDocument> {
    try {
      const id = ModelHelper.generateId();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return await modelInstance.create({ ...params, id });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err.code === "ConditionalCheckFailedException") {
        // Generated id already exists. Re-generate.
        return await ModelHelper.createWithId(modelInstance, params);
      }
      throw err;
    }
  }
}
