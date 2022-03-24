import type { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { BatchService } from "server/service/batch";
import { BatchThumbNailGenerator } from "server/service/queue/batch/batchThumbnailGenerator";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return saveThumbnail(req, res);
      default:
        res.status(405).end();
    }
  }
);

const saveThumbnail = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
  } = req;
  const service = diContainer.get<BatchService>(TYPES.BatchService);
  const batchId = id as string;

  const batch = await service.getBatch(batchId, req.uid, true);
  await new BatchThumbNailGenerator(batch).saveThumbnail();

  res.status(200).end();
};
