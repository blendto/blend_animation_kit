import { NextApiResponse } from "next";
import { BatchService } from "server/service/batch";
import { BlendService } from "server/service/blend";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getBatch(req, res);
      default:
        res.status(405).end();
    }
  }
);

const getBatch = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const {
    query: { id },
  } = req;

  const service = diContainer.get<BatchService>(TYPES.BatchService);
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const batch = await service.getBatch(id as string, req.uid);
  if (!batch) {
    return res.status(404).send("No such batch for user");
  }
  batch.blends = await blendService.getBlendIdsForBatch(id as string);
  return res.status(200).json(batch);
};
