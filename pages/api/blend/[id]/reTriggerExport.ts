import { diContainer } from "inversify.config";
import type { NextApiResponse } from "next";

import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { TYPES } from "server/types";
import { BlendVersion } from "server/base/models/blend";
import { BlendService } from "server/service/blend";
import { ExportPrepAgent } from "server/engine/blend/export";
import VesApi, { ExportRequestSchema } from "server/internal/ves";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(reTriggerExport, req, res);
      default:
        res.status(405).end();
    }
  }
);

const reTriggerExport = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };

  const service = diContainer.get<BlendService>(TYPES.BlendService);
  const currentBlend = await service.getBlend(id, { consistentRead: true });

  const { uid, buildVersion, clientType, isUserAnonymous } = req;
  const { blend } = await service.verifyExport(
    id,
    uid,
    currentBlend,
    buildVersion,
    clientType,
    isUserAnonymous
  );

  const { isWatermarked } = blend;
  const body = new ExportPrepAgent(blend).prepareForVes(isWatermarked);

  await new VesApi().saveExport({
    body,
    schema: ExportRequestSchema.Blend,
  });

  res.send(blend);
};
