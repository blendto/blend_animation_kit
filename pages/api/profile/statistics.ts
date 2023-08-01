import type { NextApiResponse } from "next";

import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(computeStatistics, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const computeStatistics = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { draftBlendIds } = req.body as { draftBlendIds: string[] };
  const uniqueIds = [...new Set(draftBlendIds ?? [])];
  const service = diContainer.get<BlendService>(TYPES.BlendService);
  const out = await service.getBlendsCount(req.uid, uniqueIds);
  res.send(out);
};
