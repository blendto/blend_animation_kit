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
import { Blend } from "server/base/models/blend";

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
  if (!batch.blends.includes(blendId)) {
    throw new UserError("Blend Id not part of the batch");
  }

  /**
   * This transformation is bad, hence, not adding this to the service.
   * Incoming body's blend.images does not adhere to StoredImage class' schema
   */
  blend.images = (blend.images as any[]).map(({ fileKey, uid }) => ({
    uri: fileKey as string,
    uid: uid as string,
  }));

  await blendService.updateBlend(blend);
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
