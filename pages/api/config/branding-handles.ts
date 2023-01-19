import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import logger from "server/base/Logger";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import ConfigService from "server/service/config";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getConfig(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getConfig = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const { ip } = req;
  const configService = diContainer.get<ConfigService>(TYPES.ConfigService);
  res.send(await configService.regionWiseOrderedBrandingHandles(ip));
};
