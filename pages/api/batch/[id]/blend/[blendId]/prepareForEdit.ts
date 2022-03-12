import { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { diContainer } from "inversify.config";
import { BatchService } from "server/service/batch";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(individualBlendEdit, req, res);
      default:
        res.status(405).end();
    }
  }
);

async function individualBlendEdit(
  req: NextApiRequestExtended,
  res: NextApiResponse
) {
  const {
    query: { id, blendId },
  } = req;

  const batchService = diContainer.get<BatchService>(TYPES.BatchService);
  await batchService.applyRecipeToBatchBlend(
    id as string,
    blendId as string,
    req.uid
  );
  res.status(200).end();
}
