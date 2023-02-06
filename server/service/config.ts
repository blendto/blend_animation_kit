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

  async branding(ip: string) {
    const userAgentDetails = await this.userService.getUserAgent(ip);
    const { logos, info } = (await this.daxStore.getItem({
      TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
      Key: { key: "branding", version: "1" },
    })) as {
      logos: {
        paths: {
          type: BrandingInfoType;
          uri: string;
          style: string;
        }[];
      };
      info: { countryWiseSortedHandles: Record<string, BrandingInfoType[]> };
    };
    return {
      logos,
      info: {
        countryWiseSortedHandles:
          info.countryWiseSortedHandles[userAgentDetails?.countryCode] ??
          info.countryWiseSortedHandles.DEFAULT,
      },
    };
  }
}
