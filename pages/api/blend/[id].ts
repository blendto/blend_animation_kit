import DynamoDB from "server/external/dynamodb";
import { DateTime } from "luxon";
import type { NextApiResponse } from "next";
import { Recipe, RecipeWrapper, StoredImage } from "server/base/models/recipe";
import {
  Blend,
  BlendStatus,
  BlendStatusUpdate,
  BlendVersion,
} from "server/base/models/blend";
import {
  CURRENT_ENCODER_VERSION,
  MIN_SUPPORTED_ENCODER_VERSION,
} from "server/constants";
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
  } = blend;

  return {
    id,
    status,
    filePath,
    imagePath,
    output,
    isWatermarked,
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
    };

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
  if (existingBlend.createdBy !== req.uid) {
    logger.error(
      `A user is trying to access another user's blend. Blend id: ${id}. ` +
        `Owner id: ${existingBlend.createdBy}. Requesting user id: ${req.uid}`
    );
    // Don't let the possible attacker know that this is a valid blend id.
    throw new ObjectNotFoundError("Blend not found");
  }

  const {
    images,
    externalImages,
    gifsOrStickers,
    texts,
    buttons,
    links,
    metadata,
  } = recipe;

  if (!metadata) {
    throw new UserError("body.metadata is missing ");
  }
  const { source } = metadata;
  if (!source) {
    throw new UserError("body.metadata.source is missing");
  }
  const { type, version } = source;
  if (!["WEB", "MOBILE"].includes(type)) {
    throw new UserError("Invalid body.metadata.source.type");
  }
  if (
    !version ||
    version < MIN_SUPPORTED_ENCODER_VERSION ||
    version > CURRENT_ENCODER_VERSION
  ) {
    throw new UserError("Unsupported body.metadata.source.version");
  }

  await ensureBrandingEntitlement(recipe, req.uid);
  const recipeWrapper = new RecipeWrapper(recipe);
  recipeWrapper.removeBrandingPlaceholders();
  const { interactions, branding } = recipe;

  // The mobile apps use "fileKey" attribute instead of uri
  // The "uri" that the server sends in chooseRecipe API is converted
  // by them and here we need to convert back
  // This is messy, we know, gotta fix.
  interface clientStoredImage extends StoredImage {
    fileKey: string;
  }

  const imageObjects = images.map((image: clientStoredImage) => ({
    uri: image.fileKey,
    uid: image.uid,
  }));

  const now = Date.now();
  const creditsService = diContainer.get<CreditsService>(TYPES.CreditsService);
  await creditsService.runWithCreditAndWatermarkCheck(
    req.uid,
    id,
    req.buildVersion,
    req.clientType,
    async (shouldWatermark: boolean, creditServiceActivityLogId: string) => {
      const update: BlendStatusUpdate = {
        status: BlendStatus.Submitted,
        on: now,
        creditServiceActivityLogId,
      };
      const updatedOn = DateTime.utc().toISODate();
      const params = {
        UpdateExpression:
          "SET #st = :s, statusUpdates = list_append(statusUpdates, :update), branding = :branding," +
          "interactions = :inter, images = :images, externalImages = :externalImages," +
          "gifsOrStickers = :gifsOrStickers, texts = :texts, buttons = :buttons, links = :links," +
          "metadata = :metadata, updatedAt = :updatedAt, updatedOn = :updatedOn, " +
          "#isWatermarked = :isWatermarked, #background = :background REMOVE expireAt",
        ExpressionAttributeNames: {
          "#st": "status",
          "#isWatermarked": "isWatermarked",
          "#background": "background",
        },
        ExpressionAttributeValues: {
          ":s": "SUBMITTED",
          ":update": [update],
          ":branding": branding || null,
          ":inter": interactions,
          ":images": imageObjects,
          ":externalImages": externalImages,
          ":gifsOrStickers": gifsOrStickers,
          ":texts": texts,
          ":buttons": buttons || [],
          ":links": links || [],
          ":metadata": metadata,
          ":updatedAt": now,
          ":updatedOn": updatedOn,
          ":isWatermarked": shouldWatermark || false,
          ":background": recipeWrapper.getBackground(version),
        },
        Key: { id },
        TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
        ReturnValues: "ALL_NEW",
      };
      const dbUpdateResponse = await DynamoDB._().updateItem(params);
      const updatedRecipe = dbUpdateResponse.Attributes;
      // Add id
      updatedRecipe.id = id;

      const body = updatedRecipe as Recipe;
      if (shouldWatermark) {
        new RecipeWrapper(body).addWatermark();
      }

      await new VesApi().saveExport({
        body,
        schema: ExportRequestSchema.Blend,
      });
      const generatedBlend = await blendService.getBlend(id, null, true);
      res.send(trim(generatedBlend));
    }
  );
};
