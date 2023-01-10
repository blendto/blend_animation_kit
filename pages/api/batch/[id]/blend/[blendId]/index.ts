import { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { diContainer } from "inversify.config";
import { BatchService } from "server/service/batch";
import { TYPES } from "server/types";
import { UserError } from "server/base/errors";
import { BlendService } from "server/service/blend";
import { IndividualBlendEditOperation } from "server/base/models/batchOperations";
import { Blend, BlendVersion } from "server/base/models/blend";
import { BatchBlendUpdater } from "server/engine/batch/batchBlendUpdater";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(updateBatchBlend, req, res);
      case "DELETE":
        return ensureAuth(deleteBatchBlend, req, res);
      default:
        res.status(405).end();
    }
  }
);

const updateBatchBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    uid,
    query: { id, blendId },
  } = req;

  const { blend } = req.body as { blend: Blend };

  if (blend.id !== blendId) {
    throw new UserError("Blend Id mismatch");
  }

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const batchService = diContainer.get<BatchService>(TYPES.BatchService);

  const batch = await batchService.getBatch(id as string, req.uid, true);
  const updater = new BatchBlendUpdater(batch);
  updater.validate(blendId);

  const dbBlend = await blendService.getBlend(
    blendId,
    BlendVersion.current,
    true
  );
  const updatedBlend = updater.updatedBlend(uid, dbBlend, blend);
  await blendService.updateBlend(updatedBlend);
  const individualEditOperation = new IndividualBlendEditOperation(blendId);
  await batchService.applyOperation(id as string, uid, individualEditOperation);
  res.status(200).end();
};

const deleteBatchBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    uid,
    query: { id, blendId },
  } = req;
  const batchService = diContainer.get<BatchService>(TYPES.BatchService);
  await batchService.deleteBatchedBlends(id as string, uid, [
    blendId as string,
  ]);
  res.status(200).end();
};
