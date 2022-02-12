import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { BatchService } from "server/service/batch";
import { BlendService } from "server/service/blend";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const service = new BatchService();
  const blendService = new BlendService();
  switch (method) {
    case "GET":
      await getBatch(req, res, service, blendService);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const getBatch = async (
  req: NextApiRequest,
  res: NextApiResponse,
  service: BatchService,
  blendService: BlendService
) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });
  const {
    query: { id },
  } = req;

  const batch = await service.getBatch(id as string, uid);
  if (!batch) {
    return res.status(404).send("No such batch for user");
  }
  batch.blends = await blendService.getBlendIdsForBatch(id as string);
  return res.status(200).json(batch);
};
