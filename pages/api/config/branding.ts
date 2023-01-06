import type { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import ConfigProvider from "server/base/ConfigProvider";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { DaxDB } from "server/external/dax";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "GET":
        return await getBrandingHandlesConfig(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getBrandingHandlesConfig = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const daxDB = diContainer.get<DaxDB>(TYPES.DaxDB);
  const { logos } = (await daxDB.getItem({
    TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
    Key: { key: "branding_handles", version: "1" },
  })) as { logos: unknown[] };
  res.send({ logos });
};
