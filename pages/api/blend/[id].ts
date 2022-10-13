import DynamoDB from "server/external/dynamodb";
import { DateTime } from "luxon";
import type { NextApiResponse } from "next";
import { Recipe, RecipeWrapper } from "server/base/models/recipe";
import { Blend, BlendStatus, BlendVersion } from "server/base/models/blend";
import { checkCompatibilityWithElements } from "server/base/errors/recipeVerification";
import ConfigProvider from "server/base/ConfigProvider";
import logger from "server/base/Logger";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import {
  ensureAuth,
  ensureBrandingEntitlement,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import {
  MethodNotAllowedError,
  ObjectNotFoundError,
  UserError,
} from "server/base/errors";
import { CreditsService } from "server/service/credits";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { BlendUpdater } from "server/engine/blend/updater";
import { IllegalBlendAccessError } from "server/base/errors/engine/blendEngineErrors";
import { ExportPrepAgent } from "server/engine/blend/export";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getBlend(req, res);
      case "POST":
        return ensureAuth(submitBlend, req, res);
      case "DELETE":
        return ensureAuth(deleteBlend, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const trimInteractions = (recipe: Recipe) => {
  const { interactions } = recipe;

  if (!interactions) {
    return [];
  }

  return interactions
    .filter((interaction) => !!interaction.userInteraction)
    .map(({ assetType, metadata, userInteraction }) => ({
      assetType,
      metadata,
      userInteraction,
    }));
};

const deleteBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
  } = req;

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  const blend = await blendService.getBlend(id as string);

  if (!blend) {
    throw new ObjectNotFoundError("Blend not found");
  }
  if (blend.createdBy !== req.uid) {
    logger.error(
      `A user is trying to access another user's blend. Blend id: ${id}. ` +
        `Owner id: ${blend.createdBy}. Requesting user id: ${req.uid}`
    );
    // Don't let the possible attacker know that this is a valid blend id.
    throw new ObjectNotFoundError("Blend not found");
  }

  if (blend.status !== "GENERATED") {
    await DynamoDB._().deleteItem({
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      Key: {
        id,
      },
    });
  } else {
    const now = Date.now();
    const updatedOn = DateTime.utc().toISODate();
    const params = {
      UpdateExpression:
        "SET #st = :s, statusUpdates = list_append(statusUpdates, :update), " +
        "updatedAt = :updatedAt, updatedOn = :updatedOn",
      ExpressionAttributeNames: {
        "#st": "status",
      },
      ExpressionAttributeValues: {
        ":s": BlendStatus.Deleted,
        ":update": [{ status: BlendStatus.Deleted, on: now }],
        ":updatedAt": now,
        ":updatedOn": updatedOn,
      },
      Key: { id },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    };

    await DynamoDB._().updateItem(params);
  }

  // Hack: To avoid consistency issues coz the app reads /blend immediately after this,
  // We wait 1 second before responding
  await new Promise((r) => {
    setTimeout(r, 1000);
  });

  res.send({ status: "Success" });
};

function trim(blend: Blend) {
  const {
    id,
    status,
    filePath,
    imagePath,
    output,
    isWatermarked,
    gifsOrStickers,
    heroImages,
  } = blend;

  return {
    id,
    status,
    filePath,
    imagePath,
    output,
    isWatermarked,
    heroImages,
    interactions: trimInteractions(blend),
    isStatic: gifsOrStickers?.length <= 0 ?? true,
  };
}

/**
 * Returns the blend with id passed in request query.
 * Retrieves the generated version by default, unless specified otherwise in the version
 * or not generated yet.
 */
const getBlend = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const {
    query: { id, format, target, consistentRead },
  } = req;
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const blend = await blendService.getBlend(
    id as string,
    BlendVersion.current,
    Boolean(consistentRead)
  );

  if (!blend || blend?.status === BlendStatus.Deleted) {
    throw new ObjectNotFoundError("Blend not found");
  }

  const recipeWrapper = new RecipeWrapper(blend);
  recipeWrapper.clean();

  const {
    images,
    externalImages,
    gifsOrStickers,
    texts,
    buttons,
    links,
    interactions,
    metadata,
    background,
    heroImages,
  } = blend;

  if (
    !checkCompatibilityWithElements(
      blend as Recipe,
      parseFloat(target as string)
    )
  ) {
    throw new UserError(
      "This recipe cannot be remixed on this app version. Please upgrade the app."
    );
  }

  if ((format as string)?.toUpperCase() === "RECIPE") {
    const recipe = {
      id,
      images,
      externalImages,
      gifsOrStickers,
      texts,
      buttons,
      links,
      interactions,
      metadata,
      background,
      heroImages,
    };

    if (blend.status === BlendStatus.Initialized) {
      throw new UserError("This blend cannot be retrieved as a recipe.");
    }

    if (metadata.source.version >= 2.0 && target == null) {
      throw new UserError(
        "This recipe cannot be remixed on this app version. Please upgrade the app."
      );
    }
    if (
      metadata.source.version < 2.0 &&
      parseFloat((target as string) ?? "1000") >= 2.0
    ) {
      throw new UserError("This recipe is old and can no longer be blended :(");
    }

    return res.send(recipe);
  }
  const trimmedBlend = trim(blend);
  res.send(trimmedBlend);
};

const submitBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const recipe = req.body as Recipe;
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  let existingBlend = await blendService.getBlend(id);
  if (!existingBlend) {
    // Blend might have expired, recreate it
    existingBlend = await blendService.addBlendToDB(id, req.uid);
  }

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

  await ensureBrandingEntitlement(recipe, req.uid);

  const creditsService = diContainer.get<CreditsService>(TYPES.CreditsService);
  await creditsService.runWithCreditAndWatermarkCheck(
    req.uid,
    id,
    req.buildVersion,
    req.clientType,
    async (shouldWatermark: boolean, creditServiceActivityLogId: string) => {
      const blend = updater.updatedBlend(req.uid, shouldWatermark);
      const dbBlend = await blendService.updateBlend(
        blend,
        creditServiceActivityLogId,
        false
      );
      const body = new ExportPrepAgent(dbBlend).prepareForVes(shouldWatermark);

      await new VesApi().saveExport({
        body,
        schema: ExportRequestSchema.Blend,
      });
      const generatedBlend = await blendService.getBlend(id, null, true);
      res.send(trim(generatedBlend));
    }
  );
};
