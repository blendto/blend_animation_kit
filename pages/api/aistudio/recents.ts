import type { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import { diContainer } from "inversify.config";
import { AIStudioService } from "server/service/aistudio";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getRecents, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getRecents = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { uid } = req;
  const { pageKey } = req.query as { pageKey: string };
  const aiStudioService = diContainer.get<AIStudioService>(
    TYPES.AIStudioService
  );

  const data = await aiStudioService.fetchRecents(uid, pageKey);
  res.send(data);
};
