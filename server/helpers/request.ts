import type { NextApiRequest, NextApiResponse } from "next";
import logger from "server/base/Logger";
import firebase from "server/external/firebase";
import {
  ObjectNotFoundError,
  UnauthorizedError,
  UserError,
} from "server/base/errors";
import { pick } from "lodash";

export type NextApiRequestExtended = NextApiRequest & {
  uid: string;
};

type RoutingFunctionExtended = (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => Promise<void>;

type RoutingFunction = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void>;

type controller = RoutingFunctionExtended;

export function withReqHandler(
  routingFunction: RoutingFunctionExtended
): RoutingFunction {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    let extendedReq = req as NextApiRequestExtended;
    try {
      extendedReq.uid = await firebase.extractUserIdFromRequest(req);
      return await routingFunction(extendedReq, res);
    } catch (err) {
      if (err instanceof UserError) {
        return res.status(400).send({ message: err.message, code: err.code });
      } else if (err instanceof UnauthorizedError) {
        return res.status(401).end();
      } else if (err instanceof ObjectNotFoundError) {
        return res.status(404).send({ message: err.message });
      }
      logger.error({
        op: "SERVER_ERROR",
        details: {
          req: pick(extendedReq, ["url", "method", "query", "body"]),
          desc: err.toString(),
          trace: err.stack,
        },
      });
      return res.status(500).send({ message: "Something went wrong!" });
    }
  };
}

export async function ensureAuth(
  controller: controller,
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  if (!req.uid) {
    throw new UnauthorizedError();
  }
  return await controller(req, res);
}
