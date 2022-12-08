import { readFileSync } from "fs";
import { UserError } from "server/base/errors";
import { Blend } from "server/base/models/blend";
import { ElementSource, Recipe } from "server/base/models/recipe";
import { BlendToRecipeConverter } from "./recipeConverter";

describe("BlendToRecipeConverter", () => {
  const blend = JSON.parse(
    readFileSync("__tests__/resources/sample-blend.json", "utf8")
  ) as Blend;
  const recipe = JSON.parse(
    readFileSync("__tests__/resources/sample-converted-recipe.json", "utf8")
  ) as Recipe;

  describe("convert fn.", () => {
    it("converts a blend to recipe", () => {
      const recipeConverter = new BlendToRecipeConverter(blend);
      expect(
        recipeConverter.convert(
          "8678574c-1e3c-43da-bd92-8404e08ce4ad",
          "68a61563-cb5a-485d-badc-c5fd6e99e655",
          "G3QXwY-Q"
        )
      ).toMatchObject(recipe);
    });

    it("validates that passed hero image id is valid", () => {
      const recipeConverter = new BlendToRecipeConverter(blend);
      expect(() =>
        recipeConverter.convert(
          "ABSENT-IMAGE-ID",
          "68a61563-cb5a-485d-badc-c5fd6e99e655",
          "G3QXwY-Q"
        )
      ).toThrow(new UserError("Invalid hero uid"));
    });

    it("validates that passed bg image id is valid", () => {
      const recipeConverter = new BlendToRecipeConverter(blend);
      expect(() =>
        recipeConverter.convert(
          "8678574c-1e3c-43da-bd92-8404e08ce4ad",
          "ABSENT-IMAGE-ID",
          "G3QXwY-Q"
        )
      ).toThrow(new UserError("Invalid background uid"));
    });

    it("validates that blend has aspect ratio", () => {
      ["width", "height"].forEach((side) => {
        const blendWithInvalidAspectRatio = JSON.parse(
          JSON.stringify(blend)
        ) as Blend;
        delete blendWithInvalidAspectRatio.metadata.aspectRatio[side];

        const recipeConverter = new BlendToRecipeConverter(
          blendWithInvalidAspectRatio
        );
        expect(() =>
          recipeConverter.convert(
            "8678574c-1e3c-43da-bd92-8404e08ce4ad",
            "68a61563-cb5a-485d-badc-c5fd6e99e655",
            "G3QXwY-Q"
          )
        ).toThrow(new UserError("Missing/invalid aspect ratio"));
      });
    });

    it("if bg image is not passed but exists, finds it from the interaction", () => {
      const recipeConverter = new BlendToRecipeConverter(blend);
      expect(
        recipeConverter.convert(
          "8678574c-1e3c-43da-bd92-8404e08ce4ad",
          undefined,
          "G3QXwY-Q"
        )
      ).toMatchObject(recipe);
    });

    it("if bg image is not passed and doesn't exist, sets elements.background as null", () => {
      const blendWithoutBgImage = JSON.parse(JSON.stringify(blend)) as Blend;
      blendWithoutBgImage.images.splice(0, 1);
      blendWithoutBgImage.interactions.splice(0, 1);

      const recipeWithElemBGAsNull = JSON.parse(
        JSON.stringify(recipe)
      ) as Recipe;
      recipeWithElemBGAsNull.images.splice(0, 1);
      recipeWithElemBGAsNull.interactions.splice(0, 1);
      recipeWithElemBGAsNull.recipeDetails.elements.background = null;

      const recipeConverter = new BlendToRecipeConverter(blendWithoutBgImage);
      expect(
        recipeConverter.convert(
          "8678574c-1e3c-43da-bd92-8404e08ce4ad",
          undefined,
          "G3QXwY-Q"
        )
      ).toMatchObject(recipeWithElemBGAsNull);
    });

    it("if hero is not passed, sets elements.hero as null", () => {
      const blendWithoutHero = JSON.parse(JSON.stringify(blend)) as Blend;
      blendWithoutHero.images.splice(2, 1);
      blendWithoutHero.interactions.splice(2, 1);

      const recipeWithElemHeroAsNull = JSON.parse(
        JSON.stringify(recipe)
      ) as Recipe;
      recipeWithElemHeroAsNull.images.splice(2, 1);
      recipeWithElemHeroAsNull.interactions.splice(2, 1);
      recipeWithElemHeroAsNull.recipeDetails.elements.hero = null;

      const recipeConverter = new BlendToRecipeConverter(blendWithoutHero);
      expect(
        recipeConverter.convert(undefined, undefined, "G3QXwY-Q")
      ).toMatchObject(recipeWithElemHeroAsNull);
    });
  });

  describe("imageDestinationURIs fn.", () => {
    it("returns a mapping of a converted recipe's image uids to their new s3 paths", () => {
      expect(
        BlendToRecipeConverter.imageDestinationURIs(
          recipe,
          ElementSource.recipe
        )
      ).toMatchObject({
        [recipe.images[0].uid]: "G3QXwY-Q/OEGlqniwhs7IUewTDf3aT.webp",
        [recipe.images[1].uid]: "G3QXwY-Q/QOTEhKBpVCq_6Ogcq_d0k.webp",
        [recipe.images[2].uid]: "G3QXwY-Q/lRcQUw-ooJWj7RjOl-sTW-bg-removed.png",
      });
    });

    it("returns a mapping of a converted branding-recipe's image uids to their new s3 paths", () => {
      const brandingId = "brandingId";
      expect(
        BlendToRecipeConverter.imageDestinationURIs(
          recipe,
          ElementSource.branding,
          brandingId
        )
      ).toMatchObject({
        [recipe.images[0].uid]:
          "brandingId/recipes/G3QXwY-Q/OEGlqniwhs7IUewTDf3aT.webp",
        [recipe.images[1].uid]:
          "brandingId/recipes/G3QXwY-Q/QOTEhKBpVCq_6Ogcq_d0k.webp",
        [recipe.images[2].uid]:
          "brandingId/recipes/G3QXwY-Q/lRcQUw-ooJWj7RjOl-sTW-bg-removed.png",
      });
    });

    it("breaks if branding id isn't passed in case of a branding-recipe", () => {
      expect(() =>
        BlendToRecipeConverter.imageDestinationURIs(
          recipe,
          ElementSource.branding
        )
      ).toThrow(new Error("Branding id is necessary to formulate paths"));
    });
  });
});
