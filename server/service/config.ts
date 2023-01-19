import { inject, injectable } from "inversify";
import ConfigProvider from "server/base/ConfigProvider";
import { DaxDB } from "server/external/dax";
import { BrandingInfoType } from "server/repositories/branding";
import { TYPES } from "server/types";
import { IService } from ".";
import { UserService } from "./user";

@injectable()
export default class ConfigService implements IService {
  @inject(TYPES.UserService) private userService: UserService;
  @inject(TYPES.DaxDB) daxStore: DaxDB;

  async regionWiseOrderedBrandingHandles(ip: string) {
    const userAgentDetails = await this.userService.getUserAgent(ip);
    const { data: handles } = (await this.daxStore.getItem({
      TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
      Key: { key: "ordered_regionwise_branding_handles", version: "1" },
    })) as { data: Record<string, BrandingInfoType[]> };
    return handles[userAgentDetails?.countryCode] ?? handles.DEFAULT;
  }
}
