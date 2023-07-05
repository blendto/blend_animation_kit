import DynamoDB from "server/external/dynamodb";
import { DateTime } from "luxon";
import type { NextApiResponse } from "next";
import { Recipe, RecipeWrapper } from "server/base/models/recipe";
import { Blend, BlendStatus } from "server/base/models/blend";
import { checkCompatibilityWithElements } from "server/base/errors/recipeVerification";
import ConfigProvider from "server/base/ConfigProvider";
import logger from "server/base/Logger";
import { diContainer } from "inversify.config";
import { BlendPatchBody, BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import {
  MethodNotAllowedError,
  ObjectNotFoundError,
  UserError,
} from "server/base/errors";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { BlendUpdater } from "server/engine/blend/updater";
import { ExportPrepAgent } from "server/engine/blend/export";
import Joi from "joi";
import { UpdateOperations } from "server/repositories";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "server/helpers/constants";
import { doesObjectExist, getObject, uploadObject } from "server/external/s3";
import {
  convertUnspportedFormatToWebp,
  createConvertedFileKey,
} from "server/helpers/imageUtils";
import { bufferToStream } from "server/helpers/bufferUtils";
import { IllegalBlendAccessError } from "server/base/errors/engine/blendEngineErrors";

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
      case "PATCH":
        return ensureAuth(updateBlend, req, res);

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
    IllegalBlendAccessError.logIllegalBlendAccess(
      id as string,
      blend.createdBy,
      req.uid,
      req.isUserAnonymous
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

export function trim(blend: Blend) {
  const {
    id,
    status,
    filePath,
    imagePath,
    metadata,
    output,
    isWatermarked,
    gifsOrStickers,
  } = blend;

  let { heroImages, fileName } = blend;

  if (!heroImages?.original) {
    heroImages = null;
  }

  if (!fileName) {
    fileName = BlendUpdater.generateDefaultFileName(Date.now());
  }

  return {
    id,
    status,
    metadata,
    filePath,
    imagePath,
    output,
    isWatermarked,
    heroImages,
    fileName,
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
  const blend = await blendService.getBlend(id as string, {
    consistentRead: Boolean(consistentRead),
  });

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
    branding,
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
      branding,
    };

    if (blend.status === BlendStatus.Initialized) {
      throw new UserError("This blend cannot be retrieved as a recipe.");
    }

    if (metadata.source.version >= 2.0 && !target) {
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

async function generate(
  blendId: string,
  uid: string,
  incomingRecipe: Recipe,
  updatedAt: number,
  isUserAnonymous: boolean
) {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const existingBlend = await blendService.getOrCreateBlend(blendId, uid);
  const { isWatermarked } = existingBlend;
  await Promise.all(
    incomingRecipe.images.map(async (img, i) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const fileKey: string = img.uri || img.fileKey;
      const fileKeyParts = fileKey.split("/");
      const [fileNameWithExt] = fileKeyParts.slice(-1);
      const fileNameArr = fileNameWithExt.split(".");
      let fileExtension = fileNameArr.pop();
      let fileNameWithoutExt = fileNameArr.join(".");
      if (fileNameArr.length <= 1) {
        // No extension in the filename
        fileNameWithoutExt = fileExtension;
        fileExtension = "";
      }
      if (
        fileExtension &&
        !VALID_UPLOAD_IMAGE_EXTENSIONS.includes(fileExtension)
      ) {
        const convertedFileKey = createConvertedFileKey(
          fileKeyParts[0],
          fileNameWithoutExt
        );
        const convertedObjectExists = await doesObjectExist(
          ConfigProvider.BLEND_INGREDIENTS_BUCKET,
          convertedFileKey
        );
        if (!convertedObjectExists) {
          // fetch, convert, upload if the converted Object doesn't already exist
          const fetchedBuffer = await getObject(
            ConfigProvider.BLEND_INGREDIENTS_BUCKET,
            fileKey
          );
          const convertedBuffer = await convertUnspportedFormatToWebp(
            fetchedBuffer,
            fileKeyParts[1],
            fileKeyParts[0]
          );
          await uploadObject(
            ConfigProvider.BLEND_INGREDIENTS_BUCKET,
            convertedFileKey,
            bufferToStream(convertedBuffer)
          ).catch((err) => {
            logger.error(err);
            throw new Error(`uploading file ${convertedFileKey} failed`);
          });
        }
        incomingRecipe.images[i].uri = convertedFileKey;
      }
    })
  );
  const updater = new BlendUpdater(existingBlend, incomingRecipe);
  const savedBlend = await blendService.updateBlend(
    updater.updatedBlend(uid, isWatermarked, isUserAnonymous),
    false,
    updatedAt
  );
  const body = new ExportPrepAgent(savedBlend).prepareForVes(isWatermarked);

  await new VesApi().saveExport({
    body,
    schema: ExportRequestSchema.Blend,
  });
  const generatedBlend = await blendService.getBlend(blendId, {
    consistentRead: true,
  });
  return trim(generatedBlend);
}

function extractSubmitBlendBody(
  body,
  version
): { recipe: Recipe; updatedAt?: number } {
  if (version === "2.0") {
    return body as { recipe: Recipe; updatedAt: number };
  }
  return { recipe: body as Recipe };
}

const submitBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id, bodyVersion } = req.query as { id: string; bodyVersion?: string };
  const { recipe, updatedAt } = extractSubmitBlendBody(req.body, bodyVersion);
  const { uid, buildVersion, clientType, isUserAnonymous } = req;
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  new RecipeWrapper(recipe).cleanDamagedInteractions();

  if (buildVersion < ConfigProvider.CLIENT_SIDE_GENERATION_BUILD_VERSION) {
    await blendService.verifyExport(
      id,
      uid,
      recipe,
      buildVersion,
      clientType,
      isUserAnonymous
    );
  }
  const trimmedBlend = await generate(
    id,
    uid,
    recipe,
    updatedAt,
    isUserAnonymous
  );
  res.send(trimmedBlend);
};

enum BlendUpdateAllowedPaths {
  fileName = "/fileName",
}

const UPDATE_BLEND_SCHEMA = Joi.object({
  changes: Joi.array()
    .items(
      Joi.object({
        path: Joi.string()
          .required()
          .valid(...Object.values(BlendUpdateAllowedPaths)),
        op: Joi.string()
          .required()
          .valid(...Object.values(UpdateOperations)),
        value: Joi.any().when("op", {
          not: "remove",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      })
    )
    .required()
    .min(1),
});

const updateBlend = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    UPDATE_BLEND_SCHEMA
  );
  const { id } = req.query as { id: string };
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const result = await blendService.updateBlendbyDelta(
    id,
    (req.body as { changes: BlendPatchBody[] }).changes
  );
  res.send(result);
};
