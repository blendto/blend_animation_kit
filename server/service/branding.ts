import "reflect-metadata";
import { injectable } from "inversify";
import { IService } from "server/service";
import ModelHelper from "server/models/helper";
import { BrandingDocument, BrandingModel } from "server/models/branding";

@injectable()
export default class BrandingService implements IService {
  model = BrandingModel;

  private async create(params: { userId: string }): Promise<BrandingDocument> {
    return await ModelHelper.createWithId<BrandingDocument>(this.model, params);
  }

  async getOrCreate(userId: string): Promise<BrandingDocument> {
    const queryRes = await this.model.query({ userId }).exec();
    if (!queryRes.length) {
      return this.create({ userId });
    }
    return queryRes[0];
  }
}
