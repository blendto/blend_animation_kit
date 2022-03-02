import type { NextApiRequest, NextApiResponse } from "next";
import logger from "server/base/Logger";
import { ObjectNotFoundError, UserError } from "server/base/errors";

type RoutingFunction = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void>;

export default function withErrorHandler(
  routingFunction: RoutingFunction
): RoutingFunction {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    try {
      return routingFunction(req, res);
    } catch (err) {
      if (err instanceof UserError) {
        return res.status(400).send({ message: err.message, code: err.code });
      } else if (err instanceof ObjectNotFoundError) {
        return res.status(404).send({ message: err.message });
      }
      logger.error({
        op: "SERVER_ERROR",
        details: {
          req,
          trace: err,
        },
      });
      return res.status(500).send({ message: "Something went wrong!" });
    }
  };
}
