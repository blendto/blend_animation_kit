import type { NextApiResponse } from "next";

import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { HeroImageIdBased } from "server/service/fileKeysProcessingStrategy";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(copyHeroToBlend, req, res);
      default:
        res.status(405).end();
    }
  }
);

const copyHeroToBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id, heroId } = req.query as { id: string; heroId: string };

  const fileKeys = await new HeroImageIdBased(heroId, id, req.uid).process();
  res.send(fileKeys);
};
