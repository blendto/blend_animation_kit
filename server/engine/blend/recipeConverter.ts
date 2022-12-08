import { nanoid } from "nanoid";
import { UserError } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import {
  AssetType,
  ElementSource,
  InteractionLayerTypes,
  Recipe,
} from "server/base/models/recipe";
import { replaceUriPrefix } from "server/helpers/fileKeyUtils";

export class BlendToRecipeConverter {
  blend: Blend;
  recipe: Recipe;

  constructor(blend: Blend) {
    this.blend = blend;
  }

  convert(
    heroAssetUid?: string,
    backgroundAssetUid?: string,
    id = nanoid(8)
  ): Recipe {
    this.recipe = JSON.parse(JSON.stringify(this.blend)) as Recipe;

    this.cleanup();
    this.recipe.recipeDetails = { elements: {} };
    this.setHero(heroAssetUid);
    this.setImageBg(backgroundAssetUid);

    this.recipe.id = id;
    this.setVariant();
    this.recipe.metadata.sourceBlendId = this.blend.id;

    return this.recipe;
  }

  private cleanup() {
    [
      "filePath",
      "imagePath",
      "thumbnail",
      "status",
      "statusUpdates",
      "version",
      "output",
      "heroImages",
      "imageFileKeys",
      "fileName",
      "createdOn",
      "createdAt",
      "updatedOn",
      "updatedAt",
    ].forEach((attr) => delete this.recipe[attr]);
  }

  private setHero(assetUid?: string) {
    this.recipe.recipeDetails.elements.hero = null;
    if (assetUid) {
      const heroInteraction = this.blend.images.find((i) => i.uid === assetUid);
      if (!heroInteraction) {
        throw new UserError("Invalid hero uid");
      }
      this.recipe.recipeDetails.elements.hero = {
        uid: assetUid,
        assetType: AssetType.IMAGE,
      };
    }
  }

  private setImageBg(assetUid?: string) {
    let assetType: string;
    if (assetUid) {
      const bgInteraction = this.blend.interactions.find(
        (i) => i.assetUid === assetUid
      );
      if (!bgInteraction) {
        throw new UserError("Invalid background uid");
      }
      ({ assetType } = bgInteraction);
    } else {
      const bgInteraction = this.blend.interactions.find(
        (i) => i.metadata.layerType === InteractionLayerTypes.Background
      );
      if (bgInteraction) {
        ({ assetUid, assetType } = bgInteraction);
      }
    }

    this.recipe.recipeDetails.elements.background = assetUid
      ? { uid: assetUid, assetType }
      : null;
  }

  private setVariant() {
    if (
      !this.blend.metadata.aspectRatio?.width ||
      !this.blend.metadata.aspectRatio?.height
    ) {
      throw new Error("Missing/invalid aspect ratio");
    }
    this.recipe.variant = `${this.blend.metadata.aspectRatio.width}:${this.blend.metadata.aspectRatio.height}`;
  }

  static imageDestinationURIs(
    recipe: Recipe,
    destinationKind: ElementSource.recipe | ElementSource.branding,
    brandingId?: string
  ) {
    if (destinationKind === ElementSource.branding && !brandingId) {
      throw new Error("Branding id is necessary to formulate paths");
    }
    const info: Record<string, string> = {};
    recipe.images.forEach((i) => {
      info[i.uid] = replaceUriPrefix(
        i.uri,
        destinationKind === ElementSource.recipe
          ? recipe.id
          : `${brandingId}/recipes/${recipe.id}`
      );
    });
    return info;
  }
}
