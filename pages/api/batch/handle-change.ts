import { _Record } from "@aws-sdk/client-dynamodb-streams/dist-types/models/models_0";
import type { NextApiResponse } from "next";
import logger from "server/base/Logger";
import { Batch } from "server/base/models/batch";
import {
  ensureServiceAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureServiceAuth(
          BlendMicroServices.AWSTriggerHandlers,
          onBatchChange,
          req,
          res
        );
      default:
        res.status(405).end();
    }
  }
);

export const onBatchChange = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const record = req.body as _Record;

  const batch = record.dynamodb.NewImage as unknown as Batch;

  logger.info({
    op: "BatchHandleChange.OnBatchChange",
    outputs: batch.outputs,
  });

  res.send({ success: true });
};
