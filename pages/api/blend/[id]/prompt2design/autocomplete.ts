import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  NextApiRequestExtended,
  ensureAuth,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(autocomplete, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

// Autocomplete api is disabled for now to avoid unnecessary cost
const autocomplete = (req: NextApiRequestExtended, res: NextApiResponse) => {
  res.send({
    options: [],
  });
};
