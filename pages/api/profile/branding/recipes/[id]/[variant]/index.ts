import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
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
      case "DELETE":
        return await ensureAuth(deleteRecipe, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

async function deleteRecipe(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  res
    .status(200)
    .send(
      await brandingService.deleteRecipe(
        req.uid,
        req.query.id as string,
        req.query.variant as string
      )
    );
}
