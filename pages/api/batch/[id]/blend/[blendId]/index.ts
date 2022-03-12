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

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(updateBatchBlend, req, res);
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
    body: { blend },
  } = req;
  if (blend.id !== blendId) {
    throw new UserError("Blend Id mismatch");
  }

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const batchService = diContainer.get<BatchService>(TYPES.BatchService);

  const batch = await batchService.getBatch(id as string, req.uid, true);
  if (!batch.blends.includes(blendId as string)) {
    throw new UserError("Blend Id not part of the batch");
  }

  /**
   * This transformation is bad, hence, not adding this to the service.
   * Incoming body's blend.images does not adhere to StoredImage class' schema
   */
  blend.images = blend.images.map(({ fileKey, uid }) => ({
    uri: fileKey,
    uid,
  }));

  await blendService.updateBlend(blend);
  const individualEditOperation = new IndividualBlendEditOperation(
    blendId as string
  );
  await batchService.applyOperation(id as string, uid, individualEditOperation);
  res.status(200).end();
};
