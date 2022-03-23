import {
  BrandingEntity,
  BrandingLogoStatus,
  BrandingStatus,
} from "server/repositories/branding";
import { UserError } from "../errors";
import { ElementSource, ImageMetadata, Recipe, RecipeWrapper } from "./recipe";
import { recipe } from "./sampleData";

describe("RecipeWrapper", () => {
  let recipeCopy: Recipe;
  beforeEach(() => {
    recipeCopy = JSON.parse(JSON.stringify(recipe)) as Recipe;
  });
  describe("replaceHero", () => {
    const fileKeys = {
      withoutBg: "MxGSFzX4/UjG7owG-HtbFG1IMKN2r1-bg-removed.png",
      original: "MxGSFzX4/UjG7owG-HtbFG1IMKN2r1.png",
    };

    it("retains the recipe as is in the absence of hero details", () => {
      delete recipeCopy.recipeDetails.elements.hero;
      const recipeCopy2 = JSON.parse(JSON.stringify(recipe)) as Recipe;
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
      const recipeCopy2 = JSON.parse(JSON.stringify(recipe)) as Recipe;
      delete recipeCopy2.branding;
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceBrandingInfo(brandingProfile);

      expect(recipeCopy).toMatchObject(recipeCopy2);
    });

    it("replaces branding details otherwise", () => {
      const wrapper = new RecipeWrapper(recipeCopy);
      wrapper.replaceBrandingInfo(brandingProfile);

      expect(recipeCopy).not.toMatchObject(recipe);

      expect(recipeCopy.branding.info).not.toHaveProperty("brandName");
      expect(recipeCopy.branding.info.whatsappNo.value).toBe(whatsappNo);
      expect(recipeCopy.branding.info.email.value).toBe(email);

      expect(recipeCopy.branding.logo.fileKey).toBe(primaryEntry);
    });
  });
});
