import type { NextApiResponse } from "next";
import { Blend } from "server/base/models/blend";
import logger from "server/base/Logger";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import {
  composeMiddlewares,
  ensureAuth,
  ensureSupportedClient,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getUserBlends, req, res);
      case "POST":
        return composeMiddlewares(
          initBlend,
          req,
          res,
          ensureSupportedClient,
          ensureAuth
        );
      default:
        res.status(405).end();
    }
  }
);

const initBlend = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const options = req.body as { batchId: string };
  try {
    const blend = await blendService.initBlend(req.uid, options);
    return res.send(blend);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
};

const getUserBlends = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const {
    query: { pageKey },
  } = req;

  let { blendsForConsistentRead } = req.query as {
    blendsForConsistentRead: string[];
  };

  if (typeof blendsForConsistentRead === "string") {
    blendsForConsistentRead = [blendsForConsistentRead];
  }

  const response: { data: Blend[]; nextPageKey: string } =
    await blendService.getUserBlends(
      req.uid,
      pageKey as string,
      blendsForConsistentRead ?? []
    );
  res.send(response);
};
