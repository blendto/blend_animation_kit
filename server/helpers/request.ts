import type { NextApiRequest, NextApiResponse } from "next";
import logger from "server/base/Logger";
import firebase from "server/external/firebase";
import {
  ObjectNotFoundError,
  UnauthorizedError,
  UserError,
} from "server/base/errors";
import { pick } from "lodash";
import { diContainer } from "inversify.config";
import InterServiceAuth, {
  BlendMicroServices,
} from "server/internal/inter-service-auth";
import { TYPES } from "server/types";

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
        return res.status(401).send({ message: err.message });
      } else if (err instanceof ObjectNotFoundError) {
        return res.status(404).send({ message: err.message });
      }
      logger.error({
        op: "SERVER_ERROR",
        details: {
          req: pick(extendedReq, ["url", "method", "uid", "query", "body"]),
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

export async function ensureServiceAuth(
  serviceType: BlendMicroServices,
  controller: controller,
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const authHeader = req.headers["x-api-token"];

  const interServiceAuth = diContainer.get<InterServiceAuth>(
    TYPES.InterServiceAuth
  );

  await interServiceAuth.validate(serviceType, authHeader as string);

  return await controller(req, res);
}
