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
        return ensureAuth(getAIBlendPhoto, req, res);
      case "POST":
        return ensureAuth(createAIBlendPhoto, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getAIBlendPhoto = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const aiStudioService = diContainer.get<AIStudioService>(
    TYPES.AIStudioService
  );
  const out = await aiStudioService.getExtendedAIBlendPhotos(id, req.uid);
  res.send(out);
};

const createAIBlendPhoto = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const aiStudioService = diContainer.get<AIStudioService>(
    TYPES.AIStudioService
  );
  const out = await aiStudioService.createAIBlendPhoto(id, req.uid);
  res.send(out);
};
