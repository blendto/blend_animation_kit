import { NextApiResponse } from "next";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { passthrough } from "server/helpers/network";
import RecoEngineApi from "server/internal/reco-engine";
import { MethodNotAllowedError } from "server/base/errors";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return searchRecipes(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const searchRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  await passthrough(req, res, () =>
    new RecoEngineApi().searchRecipes(req.query, req.body)
  );
};
