import { diContainer } from "inversify.config";
import type { NextApiResponse } from "next";

import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { TYPES } from "server/types";
import { BlendStatus, BlendVersion } from "server/base/models/blend";
import { BlendService } from "server/service/blend";
import SQS from "server/external/sqs";
import ConfigProvider from "server/base/ConfigProvider";

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
  const blend = await service.getBlend(id, BlendVersion.current, true);
  blend.status = BlendStatus.Submitted;
  blend.isWatermarked = false;
  await service.updateBlend(blend);

  // TODO: integrate credit service
  await new SQS(ConfigProvider.BLEND_GEN_QUEUE_URL).sendMessage(blend);

  res.send(blend);
};
