import { _Record } from "@aws-sdk/client-dynamodb-streams/dist-types/models/models_0";
import type { NextApiResponse } from "next";
import { Batch } from "server/base/models/batch";
import {
  ensureServiceAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import AWS from "server/external/aws";
import logger from "server/base/Logger";

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

export const onBatchChange = (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const record = req.body as _Record;

  const batch = AWS.DynamoDB.Converter.unmarshall(
    record.dynamodb.NewImage
  ) as Batch;
  logger.info(batch);
  res.send({ success: true });
};
