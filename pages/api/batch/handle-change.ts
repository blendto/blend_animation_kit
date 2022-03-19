import { _Record } from "@aws-sdk/client-dynamodb-streams/dist-types/models/models_0";
import type { NextApiResponse } from "next";
import { Batch } from "server/base/models/batch";
import {
  ensureServiceAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import { diContainer } from "inversify.config";
import { BatchService } from "server/service/batch";
import { TYPES } from "server/types";
import AWS from "server/external/aws";

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

  const batch = AWS.DynamoDB.Converter.unmarshall(
    record.dynamodb.NewImage
  ) as Batch;
  const service = diContainer.get<BatchService>(TYPES.BatchService);
  await service.consolidateBatchStatus(batch);
  res.send({ success: true });
};
