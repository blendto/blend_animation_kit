import { diContainer } from "inversify.config";
import { ObjectSchema } from "joi";
import { pick } from "lodash";
import type { NextApiRequest, NextApiResponse } from "next";

import logger from "server/base/Logger";
import {
  MethodNotAllowedError,
  ObjectNotFoundError,
  UnauthorizedError,
  UserError,
} from "server/base/errors";
import firebase from "server/external/firebase";
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
    const extendedReq = req as NextApiRequestExtended;
    try {
      extendedReq.uid = await firebase.extractUserIdFromRequest(req);
      return await routingFunction(extendedReq, res);
    } catch (err) {
      if (err instanceof UserError) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return res.status(400).send({ message: err.message, code: err.code });
      }
      if (err instanceof UnauthorizedError) {
        return res.status(401).send({ message: err.message });
      }
      if (err instanceof ObjectNotFoundError) {
        return res.status(404).send({ message: err.message });
      }
      if (err instanceof MethodNotAllowedError) {
        return res.status(405).send({ message: err.message });
      }
      logger.error({
        op: "SERVER_ERROR",
        details: {
          req: pick(extendedReq, ["url", "method", "uid", "query", "body"]),
          /* eslint-disable-next-line
            @typescript-eslint/no-unsafe-assignment,
            @typescript-eslint/no-unsafe-member-access,
            @typescript-eslint/no-unsafe-call
          */
          desc: err.toString(),
          /* eslint-disable-next-line
            @typescript-eslint/no-unsafe-assignment,
            @typescript-eslint/no-unsafe-member-access
          */
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

export enum requestComponentToValidate {
  body = "Body",
  query = "Query",
}

export function validate(
  obj: object,
  type: requestComponentToValidate,
  schema: ObjectSchema,
  required = true
) {
  if (!obj && required) {
    throw new UserError(`${type} is missing`);
  }
  const validation = schema.validate(obj);
  if (validation.error) {
    throw new UserError(
      `Error in ${type.toLowerCase()}. ${validation.error.message}.`
    );
  }
  return validation.value as unknown;
}
