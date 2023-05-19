import type { NextApiResponse } from "next";

import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import { diContainer } from "inversify.config";
import { AIStudioService } from "server/service/aistudio";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getFeedItems(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getFeedItems = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const aiStudioService = diContainer.get<AIStudioService>(
    TYPES.AIStudioService
  );
  const out = await aiStudioService.getFeedItems();
  res.status(200).send(out);
};
