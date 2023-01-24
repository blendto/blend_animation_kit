import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import { Recipe } from "server/base/models/recipe";
import { BlendUpdater } from "server/engine/blend/updater";
import {
  ensureBrandingEntitlement,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { BlendService } from "server/service/blend";
import { CreditsService } from "server/service/credits";
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

type VerifyExportResponse = { blend; didUpdate: boolean };

const verifyExport = async (
  req: NextApiRequestExtended,
  res: NextApiResponse<VerifyExportResponse>
): Promise<void> => {
  const { id } = req.query as { id: string };
  const recipe = req.body as Recipe;
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  const existingBlend = await blendService.getBlend(id);

  const updater = new BlendUpdater(existingBlend, recipe);
  updater.validate(req.uid);

  if (updater.isBlendSame()) {
    return res.send({ blend: trim(existingBlend), didUpdate: false });
  }

  await ensureBrandingEntitlement(
    recipe,
    recipe.metadata?.sourceRecipe?.source,
    req.uid
  );

  const creditsService = diContainer.get<CreditsService>(TYPES.CreditsService);
  await creditsService.runWithCreditAndWatermarkCheck(
    req.uid,
    id,
    req.buildVersion,
    req.clientType,
    async (shouldWatermark: boolean, creditServiceActivityLogId: string) => {
      const dbBlend = await blendService.reportExport(
        id,
        shouldWatermark,
        creditServiceActivityLogId,
        updater.incomingBlendHash()
      );

      res.send({ blend: trim(dbBlend), didUpdate: true });
    }
  );
};
