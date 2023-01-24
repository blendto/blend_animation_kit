import { Recipe, RecipeWrapper, StoredImage } from "server/base/models/recipe";
import { ObjectNotFoundError, UserError } from "server/base/errors";
import {
  CURRENT_ENCODER_VERSION,
  MIN_SUPPORTED_ENCODER_VERSION,
} from "server/constants";
import { Blend } from "server/base/models/blend";
import logger from "server/base/Logger";
import objectHash from "object-hash";

export class BlendUpdater {
  existingBlend: Blend;
  incomingRecipe: Recipe;

  constructor(existingBlend: Blend, incomingRecipe: Recipe) {
    this.existingBlend = existingBlend;
    this.incomingRecipe = incomingRecipe;
  }

  static isDefaultFileNameFormat(name: string): boolean {
    return /blend[\d+]{12}/.test(name);
  }

  static generateDefaultFileName(createdAt: number): string {
    const date = new Date(createdAt);
    return "".concat(
      "blend",
      String(date.getUTCDate()).padStart(2, "0"),
      String(date.getUTCMonth()).padStart(2, "0"),
      String(date.getUTCFullYear()).slice(2),
      String(date.getUTCHours()).padStart(2, "0"),
      String(date.getUTCMinutes()).padStart(2, "0"),
      String(date.getUTCSeconds()).padStart(2, "0")
    );
  }

  validate(updaterUid: string) {
    if (this.existingBlend.createdBy !== updaterUid) {
      logger.error(
        `A user is trying to access another user's blend. Blend id: ${this.existingBlend.id}. ` +
          `Owner id: ${this.existingBlend.createdBy}. Requesting user id: ${updaterUid}`
      );
      // Don't let the possible attacker know that this is a valid blend id.
      throw new ObjectNotFoundError("Blend not found");
    }

    const { metadata } = this.incomingRecipe;

    if (!metadata) {
      throw new UserError("body.metadata is missing");
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

    if (!this.incomingRecipe.heroImages?.original) {
      this.incomingRecipe.heroImages = null;
    }
  }

  updatedBlend(updaterUid: string, shouldWatermark: boolean): Blend {
    this.validate(updaterUid);

    const {
      images,
      externalImages,
      gifsOrStickers,
      texts,
      buttons,
      links,
      metadata,
    } = this.incomingRecipe;

    const {
      source: { version },
    } = metadata;

    const recipeWrapper = new RecipeWrapper(this.incomingRecipe);
    const { interactions, branding } = this.incomingRecipe;

    // The mobile apps use "fileKey" attribute instead of uri
    // The "uri" that the server sends in chooseRecipe API is converted
    // by them and here we need to convert back
    // This is messy, we know, gotta fix.
    interface ClientStoredImage extends StoredImage {
      fileKey: string;
    }

    const imageObjects = images.map((image: ClientStoredImage) => ({
      uri: image.fileKey,
      uid: image.uid,
    }));

    const filename = this.existingBlend.fileName;
    if (!filename || BlendUpdater.isDefaultFileNameFormat(filename)) {
      this.existingBlend.fileName = BlendUpdater.generateDefaultFileName(
        Date.now()
      );
    }

    return {
      ...this.existingBlend,
      isWatermarked: shouldWatermark,
      interactions,
      images: imageObjects,
      externalImages,
      gifsOrStickers,
      texts,
      metadata,
      background: recipeWrapper.getBackground(version),
      branding: branding || null,
      buttons,
      links,
    };
  }

  incomingBlendHash(): string {
    return objectHash.MD5(this.getPartialForComparison());
  }

  isBlendSame(): boolean {
    const hash = this.incomingBlendHash();
    return this.existingBlend.statusUpdates.some((s) => s.blendHash === hash);
  }

  private getPartialForComparison(): object {
    // Not comparing `images` because `images` would be incorrect/missing
    // in the incoming blend in the `/verifyExport` flow
    const {
      interactions,
      externalImages,
      gifsOrStickers,
      texts,
      metadata,
      background,
      branding,
    } = this.incomingRecipe;
    return {
      interactions,
      externalImages,
      gifsOrStickers,
      texts,
      metadata,
      background,
      branding,
    };
  }
}
