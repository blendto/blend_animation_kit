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
      case "POST":
        return ensureAuth(resetAIBlendPhoto, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const resetAIBlendPhoto = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const service = diContainer.get<AIStudioService>(TYPES.AIStudioService);
  const out = await service.resetAIBlendPhoto(id, req.uid);
  res.send(out);
};
