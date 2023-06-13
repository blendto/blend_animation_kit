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
import { extractLocale } from "server/helpers/localisation";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getSceneConfigOptions, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getSceneConfigOptions = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { language } = extractLocale(req.headers["accept-language"]);
  const { id } = req.query as { id: string };
  const service = diContainer.get<AIStudioService>(TYPES.AIStudioService);
  const out = await service.fetchSceneConfigOptions(id, language);
  res.send(out);
};
