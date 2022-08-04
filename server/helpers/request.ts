import { diContainer } from "inversify.config";
import { ObjectSchema } from "joi";
import { isEmpty, pick } from "lodash";
import type { NextApiRequest, NextApiResponse } from "next";

import logger from "server/base/Logger";
import {
  ForbiddenError,
  MethodNotAllowedError,
  ObjectNotFoundError,
  UnauthorizedError,
  UserError,
} from "server/base/errors";
import Firebase from "server/external/firebase";
import InterServiceAuth, {
  BlendMicroServices,
} from "server/internal/inter-service-auth";
import { TYPES } from "server/types";
import { Recipe } from "server/base/models/recipe";
import { Entitlement, revenueCat } from "server/external/revenue-cat";
import Cors from "cors";
import { initMiddleware } from "server/helpers/middleware";

export type NextApiRequestExtended = NextApiRequest & {
  uid: string;
  buildVersion?: number;
  clientType?: string;
};

const cors = Cors({
  methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE"],
});

const corsMiddleware = initMiddleware(cors);

type RoutingFunctionExtended = (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => Promise<void> | void;

type RoutingFunction = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void>;

type controller = RoutingFunctionExtended;

export enum AuthType {
  USER = "USER",
  SERVICE = "SERVICE",
}

export function withReqHandler(
  routingFunction: RoutingFunctionExtended,
  authType = AuthType.USER
): RoutingFunction {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    await corsMiddleware(req, res);
    const extendedReq = req as NextApiRequestExtended;
    try {
      if (authType === AuthType.USER) {
        const firebaseService = diContainer.get<Firebase>(TYPES.Firebase);
        extendedReq.uid = await firebaseService.extractUserIdFromRequest(req);
        extendedReq.buildVersion = extractBuildVersion(req);
        extendedReq.clientType = req.headers["x-client-type"] as string;
      }
      return await routingFunction(extendedReq, res);
    } catch (err) {
      if (err instanceof UserError) {
        logger.debug({
          op: "USER_ERROR",
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return res.status(400).send({ message: err.message, code: err.code });
      }
      if (err instanceof UnauthorizedError) {
        return res.status(401).send({ message: err.message });
      }
      if (err instanceof ForbiddenError) {
        return res.status(403).send({ message: err.message });
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
  await controller(req, res);
}

export async function ensureServiceAuth(
  serviceType: BlendMicroServices,
  controller: controller,
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  let authHeader: string;
  if (req.headers["x-api-token"]) {
    authHeader = req.headers["x-api-token"] as string;
  } else {
    authHeader = (req.headers.authorization || "Bearer ").split(" ")[1];
  }

  const interServiceAuth = diContainer.get<InterServiceAuth>(
    TYPES.InterServiceAuth
  );

  await interServiceAuth.validate(serviceType, authHeader);

  await controller(req, res);
}

async function ensureEntitlement(userId: string, entitlement: Entitlement) {
  if (!(await revenueCat.hasEntitlement(userId, entitlement))) {
    throw new ForbiddenError(`User doesn't have ${entitlement} entitlement`);
  }
}

export async function ensureBrandingEntitlement(
  recipe: Recipe,
  userId: string
) {
  if (!isEmpty(recipe.branding)) {
    await ensureEntitlement(userId, Entitlement.BRANDING);
  }
}

export enum requestComponentToValidate {
  body = "Body",
  query = "Query",
}

export function validate(
  obj: object,
  type: requestComponentToValidate,
  schema: ObjectSchema,
  required = true,
  allowUnknown = false
) {
  if (!obj && required) {
    throw new UserError(`${type} is missing`);
  }
  const validation = schema.validate(obj, { allowUnknown });
  if (validation.error) {
    throw new UserError(
      `Error in ${type.toLowerCase()}. ${validation.error.message}.`
    );
  }
  return validation.value as unknown;
}

function extractBuildVersion(req: NextApiRequest): number {
  const versionStr = req.headers["x-client-version"] as unknown;
  const version = parseInt(versionStr as string, 10);
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(version)) {
    return null;
  }
  return version;
}
