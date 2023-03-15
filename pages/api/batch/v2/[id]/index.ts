import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { BatchV2Service } from "server/service/batch-v2";
import { MethodNotAllowedError } from "server/base/errors";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getBatch, req, res);
      case "DELETE":
        return ensureAuth(deleteBatch, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getBatch = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const {
    query: { id },
  } = req;

  const service = diContainer.get<BatchV2Service>(TYPES.BatchV2Service);
  const batch = await service.getBatchOrFail(id as string, req.uid);
  return res.send(batch);
};

const deleteBatch = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    uid,
    query: { id },
  } = req;
  const batchService = diContainer.get<BatchV2Service>(TYPES.BatchV2Service);
  await batchService.deleteBatch(id as string, uid);
  res.end();
};
