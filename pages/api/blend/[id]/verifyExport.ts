import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import { Recipe } from "server/base/models/recipe";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { trim } from "../[id]";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return verifyExport(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const verifyExport = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> => {
  const { id } = req.query as { id: string };
  const recipe = req.body as Recipe;
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const { uid, buildVersion, clientType, isUserAnonymous } = req;

  const { blend, didUpdate } = await blendService.verifyExport(
    id,
    uid,
    recipe,
    buildVersion,
    clientType,
    isUserAnonymous
  );
  res.send({ blend: trim(blend), didUpdate });
};
