import { readFileSync } from "fs";
import { UserError } from "../errors";
import {
  AssetType,
  ElementSource,
  ImageMetadata,
  InteractionAction,
  InteractionLayerTypes,
  Recipe,
  RecipeWrapper,
} from "./recipe";
import { BrandingRecipe } from "./brandingRecipe";

function getSampleRecipe() {
  return JSON.parse(
    readFileSync("__tests__/resources/sample-recipe.json", "utf8")
  ) as Recipe;
}

function addBrandingRecipeMockDetails(recipe: BrandingRecipe) {
  recipe.brandingId = "foobar";
  recipe.userId = "johndoe";
  recipe.lastUsedAt = new Date().getUTCMilliseconds();
}

describe("RecipeWrapper", () => {
  const recipe = getSampleRecipe();
  let recipeCopy: Recipe;
  beforeEach(() => {
    recipeCopy = getSampleRecipe();
  });
  describe("replaceHero", () => {
    const fileKeys = {
      withoutBg: "MxGSFzX4/UjG7owG-HtbFG1IMKN2r1-bg-removed.png",
      original: "MxGSFzX4/UjG7owG-HtbFG1IMKN2r1.png",
    };

    it("puts a default hero in the absence of hero details", () => {
      delete recipeCopy.recipeDetails.elements.hero;
      addBrandingRecipeMockDetails(recipeCopy as BrandingRecipe);
      const recipeCopy2 = getSampleRecipe();
      addBrandingRecipeMockDetails(recipeCopy2 as BrandingRecipe);
      delete recipeCopy2.recipeDetails.elements.hero;
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceHero(fileKeys);

      recipeCopy2.images.push({
        uid: recipeCopy.recipeDetails.elements.hero.uid,
        uri: "MxGSFzX4/UjG7owG-HtbFG1IMKN2r1-bg-removed.png",
        source: ElementSource.blend,
      });
      recipeCopy2.interactions.push({
        action: InteractionAction.DISPLAY_INLINE,
        assetType: AssetType.IMAGE,
        assetUid: recipeCopy.recipeDetails.elements.hero.uid,
        metadata: {
          $: "ImageMetadata",
          hasBgRemoved: true,
          layerType: InteractionLayerTypes.Image,
          position: { dx: 54.191761363636374, dy: 96.3409090909091 },
          relativeSize: {
            width: 361.27840909090907,
            height: 642.2727272727273,
          },
          rotation: 0,
          rotationOrigin: "CENTER",
          rotationX: 0,
          rotationY: 0,
          size: { width: 252.89488636363632, height: 449.59090909090907 },
          zIndex: 10,
        } as ImageMetadata,
        time: 0,
      });
      expect(recipeCopy).toMatchObject(recipeCopy2);
    });

    it("rejects requests if hero image/interaction is missing/incorrect", () => {
      recipeCopy.images.splice(0, 1);
      const wrapper = new RecipeWrapper(recipeCopy);

      expect(wrapper.replaceHero.bind(wrapper, fileKeys)).toThrow(
        new UserError(`Either/both of hero image and interaction is missing`)
      );
    });

    it("with bg removed", () => {
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceHero(fileKeys);

      expect(recipeCopy).not.toMatchObject(recipe);

      const heroImageElement = recipeCopy.images[0];
      expect(heroImageElement.source).toBe(ElementSource.blend);
      expect(heroImageElement.uri).toBe(fileKeys.withoutBg);

      const heroImageInteraction = recipeCopy.interactions[0];
      expect(heroImageInteraction).not.toHaveProperty("cropRect");
    });

    it("with original", () => {
      const heroImageInteraction = recipeCopy.interactions[0]
        .metadata as ImageMetadata;
      heroImageInteraction.hasBgRemoved = false;
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceHero(fileKeys);

      expect(recipeCopy).not.toMatchObject(recipe);

      const heroImageElement = recipeCopy.images[0];
      expect(heroImageElement.source).toBe(ElementSource.blend);
      expect(heroImageElement.uri).toBe(fileKeys.original);

      expect(heroImageInteraction).not.toHaveProperty("cropRect");
    });
  });
});
