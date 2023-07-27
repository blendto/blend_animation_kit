import type { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import ConfigService from "server/service/config";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "GET":
        return await getTextBackgroundsConfig(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getTextBackgroundsConfig = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const configService = diContainer.get<ConfigService>(TYPES.ConfigService);
  res.send(await configService.textBackgrounds());
};
