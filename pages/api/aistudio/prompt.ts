import type { NextApiResponse } from "next";

import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import { diContainer } from "inversify.config";
import { AIStudioService } from "server/service/aistudio";
import { TYPES } from "server/types";
import { SceneConfig } from "server/base/models/aistudio";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return constructPrompt(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const constructPrompt = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { sceneConfig } = req.body as { sceneConfig: SceneConfig };
  const aiStudioService = diContainer.get<AIStudioService>(
    TYPES.AIStudioService
  );
  const out = await aiStudioService.constructPrompt(sceneConfig);
  res.status(200).send(out);
};
