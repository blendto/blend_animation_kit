import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { BatchService } from "server/service/batch";
import { BlendService } from "server/service/blend";
import { DynamoBasedServiceLocator, IServiceLocator } from "server/service";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const serviceLocator = DynamoBasedServiceLocator.instance;
  switch (method) {
    case "GET":
      await getBatch(req, res, serviceLocator);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const getBatch = async (
  req: NextApiRequest,
  res: NextApiResponse,
  serviceLocator: IServiceLocator
) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });
  const {
    query: { id },
  } = req;

  const service = serviceLocator.find(BatchService);
  const blendService = serviceLocator.find(BlendService);
  const batch = await service.getBatch(id as string, uid);
  if (!batch) {
    return res.status(404).send("No such batch for user");
  }
  batch.blends = await blendService.getBlendIdsForBatch(id as string);
  return res.status(200).json(batch);
};
