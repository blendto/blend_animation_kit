import { nanoid } from "nanoid";
import { UserError } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import {
  AssetType,
  ElementSource,
  InteractionLayerTypes,
  Recipe,
  StoredImage,
} from "server/base/models/recipe";
import { replaceUriPrefix } from "server/helpers/fileKeyUtils";

export class BlendToRecipeConverter {
  blend: Blend;
  recipe: Recipe;

  constructor(blend: Blend) {
    this.blend = blend;
  }

  convert(
    heroAssetUids?: string[],
    backgroundAssetUid?: string,
    id = nanoid(8)
  ): Recipe {
    this.recipe = JSON.parse(JSON.stringify(this.blend)) as Recipe;

    this.cleanup();
    this.recipe.recipeDetails = { elements: {} };
    this.setHeroes(heroAssetUids);
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

  private setHeroes(assetUids?: string[]) {
    this.recipe.recipeDetails.elements.hero = null;
    this.recipe.recipeDetails.elements.heroes = [];
    if (assetUids?.length) {
      assetUids.forEach((assetUid) => {
        const heroInteraction = this.blend.images.find(
          (i) => i.uid === assetUid
        );
        if (!heroInteraction) {
          throw new UserError("Invalid hero uid");
        }
        this.recipe.recipeDetails.elements.heroes.push({
          uid: assetUid,
          assetType: AssetType.IMAGE,
        });
      });
      this.recipe.recipeDetails.elements.hero =
        this.recipe.recipeDetails.elements.heroes[0];
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
    images: StoredImage[],
    destinationKind: ElementSource.recipe | ElementSource.branding,
    recipeId: string,
    brandingId?: string
  ) {
    if (destinationKind === ElementSource.branding && !brandingId) {
      throw new Error("Branding id is necessary to formulate paths");
    }
    const info: Record<string, string> = {};
    images.forEach((i) => {
      info[i.uid] = replaceUriPrefix(
        i.uri,
        destinationKind === ElementSource.recipe
          ? recipeId
          : `${brandingId}/recipes/${recipeId}`
      );
    });
    return info;
  }
}
