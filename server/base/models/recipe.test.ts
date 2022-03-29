import { readFileSync } from "fs";
import { omit } from "lodash";
import {
  BrandingEntity,
  BrandingInfoType,
  BrandingLogoStatus,
  BrandingStatus,
} from "server/repositories/branding";
import { UserError } from "../errors";
import { ElementSource, ImageMetadata, Recipe, RecipeWrapper } from "./recipe";

function getSampleRecipe() {
  return JSON.parse(
    readFileSync("__tests__/resources/sample-recipe.json", "utf8")
  ) as Recipe;
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

    it("retains the recipe as is in the absence of hero details", () => {
      delete recipeCopy.recipeDetails.elements.hero;
      const recipeCopy2 = getSampleRecipe();
      delete recipeCopy2.recipeDetails.elements.hero;
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceHero(fileKeys);

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

  describe("replaceBrandingInfo", () => {
    const id = "wNALVbEj";
    const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
    const updatedAt = 1646906641;
    const status = BrandingStatus.CREATED;
    const whatsappNo = "+99 999 999 9999";
    const email = "engg@blend.to";
    const primaryEntry = "wNALVbEj/7UybDOVCtQKCApD-6cjxi.jpeg";
    const brandingProfile: BrandingEntity = {
      id,
      userId,
      logos: {
        entries: [
          { fileKey: primaryEntry, status: BrandingLogoStatus.UPLOADED },
        ],
        primaryEntry,
      },
      updatedAt,
      status,
      whatsappNo,
      email,
    };

    it("retains the recipe as is in the absence of branding details", () => {
      delete recipeCopy.branding;
      const recipeCopy2 = getSampleRecipe();
      delete recipeCopy2.branding;
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceBrandingInfo(brandingProfile);

      expect(recipeCopy).toMatchObject(recipeCopy2);
    });

    it("replaces info if available", () => {
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceBrandingInfo(
        omit(brandingProfile, "logos.primaryEntry", "logos.entries.0")
      );

      expect(recipeCopy).not.toMatchObject(recipe);

      expect(recipeCopy.branding.info.isPlaceholder).toBe(false);
      expect(recipeCopy.branding.info.data.whatsappNo.value).toBe(whatsappNo);
      expect(recipeCopy.branding.info.data.email.value).toBe(email);
      expect(recipeCopy.branding.info.data).not.toHaveProperty("brandName");

      expect(recipeCopy.branding.logo).toMatchObject(recipe.branding.logo);
    });

    it("replaces logo if available", () => {
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceBrandingInfo(
        omit(
          brandingProfile,
          BrandingInfoType.WhatsappNo,
          BrandingInfoType.Email
        )
      );

      expect(recipeCopy).not.toMatchObject(recipe);

      expect(recipeCopy.branding.info).toMatchObject(recipe.branding.info);

      expect(recipeCopy.branding.logo.isPlaceholder).toBe(false);
      expect(recipeCopy.branding.logo.data.fileKey).toBe(primaryEntry);
    });

    it("replaces both info and logo if available", () => {
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceBrandingInfo(brandingProfile);

      expect(recipeCopy).not.toMatchObject(recipe);

      expect(recipeCopy.branding.info.isPlaceholder).toBe(false);
      expect(recipeCopy.branding.info.data.whatsappNo.value).toBe(whatsappNo);
      expect(recipeCopy.branding.info.data.email.value).toBe(email);
      expect(recipeCopy.branding.info.data).not.toHaveProperty("brandName");

      expect(recipeCopy.branding.logo.isPlaceholder).toBe(false);
      expect(recipeCopy.branding.logo.data.fileKey).toBe(primaryEntry);
    });
  });

  describe("removeBrandingPlaceholders", () => {
    it("Removes the placeholder branding attributes", () => {
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.removeBrandingPlaceholders();

      expect(recipeCopy).not.toMatchObject(recipe);
      expect(recipeCopy.branding).toMatchObject({});
      expect(recipeCopy.interactions.length).toBe(
        recipe.interactions.length - 2
      );
      expect(
        recipeCopy.interactions.find(
          (i) => i.metadata.$ === "BrandingLogoMetadata"
        )
      ).toBe(undefined);
      expect(
        recipeCopy.interactions.find(
          (i) => i.metadata.$ === "BrandingInfoMetadata"
        )
      ).toBe(undefined);
    });
  });
});
