import type { NextApiResponse } from "next";
import {
  ensureAuth,
  ensureBrandingEntitlement,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError, ObjectNotFoundError } from "server/base/errors";
import { Recipe } from "server/base/models/recipe";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import { BlendUpdater } from "server/engine/blend/updater";
import { IllegalBlendAccessError } from "server/base/errors/engine/blendEngineErrors";
import logger from "server/base/Logger";
import { CreditsService } from "server/service/credits";
import { ExportPrepAgent } from "server/engine/blend/export";
import VesApi, { SuppliedFFmpegDependencies } from "server/internal/ves";
import { Blend } from "server/base/models/blend";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(generateCommand, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const generateCommand = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const body = req.body as {
    recipe: Recipe;
    dependencies: SuppliedFFmpegDependencies;
  };
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  let existingBlend = await blendService.getBlend(id);
  if (!existingBlend) {
    // Blend might have expired, recreate it
    existingBlend = await blendService.addBlendToDB(id, req.uid);
  }

  const { recipe, dependencies } = body;

  const updater = new BlendUpdater(existingBlend, recipe);
  try {
    updater.validate(req.uid);
  } catch (e: unknown) {
    if (e instanceof IllegalBlendAccessError) {
      logger.error(
        `A user is trying to access another user's blend. Blend id: ${id}. ` +
          `Owner id: ${existingBlend.createdBy}. Requesting user id: ${req.uid}`
      );
      // Don't let the possible attacker know that this is a valid blend id.
      throw new ObjectNotFoundError("Blend not found");
    }
  }

  await ensureBrandingEntitlement(
    recipe,
    recipe.metadata.sourceRecipe.source,
    req.uid
  );
  const creditsService = diContainer.get<CreditsService>(TYPES.CreditsService);
  await creditsService.runWithCreditAndWatermarkCheck(
    req.uid,
    id,
    req.buildVersion,
    req.clientType,
    async (shouldWatermark: boolean) => {
      const blend = updater.updatedBlend(req.uid, shouldWatermark);
      const body = new ExportPrepAgent(blend).prepareForVes(shouldWatermark);

      const commands = await new VesApi().generateFFmpegCommands({
        blend: body as Blend,
        dependencies,
      });
      res.send(commands);
    }
  );
};
