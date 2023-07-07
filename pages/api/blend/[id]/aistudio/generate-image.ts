import type { NextApiResponse } from "next";

import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import {
  GenerateSamplesRequest,
  MetadataBasedGenerationRequest,
} from "server/base/models/aistudio";
import { diContainer } from "inversify.config";
import { AIStudioService } from "server/service/aistudio";
import { TYPES } from "server/types";
import { fireAndForget } from "server/helpers/async-runner";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(generateImage, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const generateImage = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const generateSamplesRequest = GenerateSamplesRequest.deserialize(
    req.body as Record<string, unknown>
  );
  const aiStudioService = diContainer.get<AIStudioService>(
    TYPES.AIStudioService
  );

  if (
    generateSamplesRequest instanceof MetadataBasedGenerationRequest &&
    generateSamplesRequest.recentsStudioGenerationId
  ) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fireAndForget(() =>
      aiStudioService.markRecentsImageUsage(
        generateSamplesRequest.recentsStudioGenerationId
      )
    );
  }

  const out = await aiStudioService.syncGenerateImage(
    id,
    generateSamplesRequest,
    req.uid
  );
  res.status(200).send(out);
};
