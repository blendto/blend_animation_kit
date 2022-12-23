import type { NextApiResponse } from "next";

import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
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
        return getTopics(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getTopics = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const { language } = extractLocale(req.headers["accept-language"]);
  const aiStudioService = diContainer.get<AIStudioService>(
    TYPES.AIStudioService
  );
  const out = await aiStudioService.getTopics(language);
  res.status(200).send(out);
};
