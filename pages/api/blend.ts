import type { NextApiResponse } from "next";
import { Blend } from "server/base/models/blend";
import logger from "server/base/Logger";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getAllBlends, req, res);
      case "POST":
        return ensureAuth(initBlend, req, res);
      default:
        res.status(405).end();
    }
  }
);

const initBlend = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  try {
    const blend = await blendService.initBlend(req.uid);
    return res.send(blend);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
};

const getAllBlends = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const {
    query: { pageKey },
  } = req;
  const response: { data: Blend[]; nextPageKey: string } =
    await blendService.getAllBlendsForUser(req.uid, pageKey as string);

  const op = "getAllBlends_API_CALL";
  const blendsCount = response?.data?.length;
  const { nextPageKey } = response;
  logger.info({
    op,
    message: { uid: req.uid, response: { blendsCount, nextPageKey } },
  });

  res.send(response);
};
