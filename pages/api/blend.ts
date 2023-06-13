import Joi from "joi";
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
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { SourceMetadata, SourceMetadataType } from "server/base/models/recipe";

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

const INIT_REQUEST_SCHEMA = Joi.object({
  batchId: Joi.string(),
  sourceMetadata: {
    type: Joi.string().valid(...Object.values(SourceMetadataType)),
    version: Joi.number(),
  },
});

const initBlend = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    INIT_REQUEST_SCHEMA
  ) as {
    batchId?: string;
    sourceMetadata?: SourceMetadata;
  };
  try {
    const blend = await blendService.initBlend(req.uid, body);
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
