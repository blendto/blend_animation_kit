import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  NextApiRequestExtended,
  ensureAuth,
  withReqHandler,
} from "server/helpers/request";
import { BlendService } from "server/service/blend";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(resetBlend, req, res);
      default:
        res.status(405).end();
    }
  }
);

const resetBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const blend = await blendService.getBlend(id, { userId: req.uid });

  const updatedBlend = await blendService.addBlendToDB(id, req.uid, {
    sourceMetadata: blend.metadata?.source,
  });

  res.send(updatedBlend);
};
