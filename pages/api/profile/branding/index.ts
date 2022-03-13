import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import BrandingService from "server/service/branding";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "GET":
        return await ensureAuth(getBranding, req, res);
      default:
        res.status(405).send({ message: "Method not allowed" });
    }
  }
);

async function getBranding(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  res.send(await brandingService.getOrCreate(req.uid));
}
