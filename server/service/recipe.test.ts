import { readFileSync } from "fs";
import { diContainer } from "inversify.config";
import { omit } from "lodash";
import { ElementSource, Recipe } from "server/base/models/recipe";
import {
  BrandingEntity,
  BrandingInfoType,
  BrandingLogoStatus,
  BrandingStatus,
} from "server/repositories/branding";
import { TYPES } from "server/types";
import { RecipeService } from "./recipe";

function getSampleRecipe() {
  return JSON.parse(
    readFileSync("__tests__/resources/sample-recipe.json", "utf8")
  ) as Recipe;
}

describe("RecipeService", () => {
  const recipeService = diContainer.get<RecipeService>(TYPES.RecipeService);
  const recipe = getSampleRecipe();
  let recipeCopy: Recipe;

  beforeEach(() => {
    recipeCopy = getSampleRecipe();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("replaceBrandingInfo", () => {
    const id = "wNALVbEj";
    const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
    const updatedAt = 1646906641;
    const status = BrandingStatus.CREATED;
    const whatsappNo = "WHATEVER";
    const email = "WHATEVER";
    const primaryEntry = "wNALVbEj/7UybDOVCtQKCApD-6cjxi.jpeg";
    const brandingProfile: BrandingEntity = {
      id,
      userId,
      logos: {
        entries: [
          {
            fileKey: primaryEntry,
            status: BrandingLogoStatus.UPLOADED,
            size: { width: 128, height: 128 },
            removeBg: false,
          },
        ],
        primaryEntry,
      },
      updatedAt,
      status,
      info: [
        { type: BrandingInfoType.WhatsappNo, value: whatsappNo },
        { type: BrandingInfoType.Email, value: email },
      ],
    };

    it("replaces info if available and deletes logo if unavailable", async () => {
      jest
        .spyOn(recipeService.configService, "regionWiseOrderedBrandingHandles")
        .mockResolvedValueOnce([]);
      await recipeService.replaceBrandingInfo(
        recipeCopy,
        omit(brandingProfile, "logos.primaryEntry", "logos.entries.0"),
        undefined
      );

      expect(recipeCopy).not.toMatchObject(recipe);
      expect(recipeCopy.branding.info.data).toMatchObject([
        {
          type: BrandingInfoType.WhatsappNo,
          value: "WHATEVER",
        },
        {
          type: BrandingInfoType.Email,
          value: "WHATEVER",
        },
      ]);
      expect(recipeCopy.branding).not.toHaveProperty("logo");
      expect(recipeCopy.interactions.length).toEqual(
        recipe.interactions.length - 1
      );
      expect(
        recipeCopy.interactions.find(
          (i) => i.metadata.$ === "BrandingLogoMetadata"
        )
      ).toEqual(undefined);
    });

    it("replaces logo if available and deletes info if unavailable", async () => {
      jest
        .spyOn(recipeService.configService, "regionWiseOrderedBrandingHandles")
        .mockResolvedValueOnce([]);
      await recipeService.replaceBrandingInfo(
        recipeCopy,
        {
          ...brandingProfile,
          info: [],
        },
        undefined
      );

      expect(recipeCopy).not.toMatchObject(recipe);
      expect(recipeCopy.branding).not.toHaveProperty("info");
      expect(recipeCopy.interactions.length).toEqual(
        recipe.interactions.length - 1
      );
      expect(
        recipeCopy.interactions.find(
          (i) => i.metadata.$ === "BrandingInfoMetadata"
        )
      ).toEqual(undefined);
      expect(recipeCopy.branding.logo.data).toMatchObject({
        uri: primaryEntry,
        source: ElementSource.branding,
      });
    });

    it("replaces both info and logo if available", async () => {
      jest
        .spyOn(recipeService.configService, "regionWiseOrderedBrandingHandles")
        .mockResolvedValueOnce([]);
      await recipeService.replaceBrandingInfo(
        recipeCopy,
        brandingProfile,
        undefined
      );

      expect(recipeCopy).not.toMatchObject(recipe);
      expect(recipeCopy.branding.info.data).toMatchObject([
        {
          type: BrandingInfoType.WhatsappNo,
          value: "WHATEVER",
        },
        {
          type: BrandingInfoType.Email,
          value: "WHATEVER",
        },
      ]);
      expect(recipeCopy.branding.logo.data).toMatchObject({
        uri: primaryEntry,
        source: ElementSource.branding,
      });
      expect(recipeCopy.interactions.length).toEqual(
        recipe.interactions.length
      );
    });

    it("if available, adds other handles from profile and tries to match the original count", async () => {
      jest
        .spyOn(recipeService.configService, "regionWiseOrderedBrandingHandles")
        .mockResolvedValueOnce([
          BrandingInfoType.BrandName,
          BrandingInfoType.WhatsappNo,
          BrandingInfoType.ShopeeHandle,
          BrandingInfoType.InstaHandle,
          BrandingInfoType.TiktokHandle,
          BrandingInfoType.ContactNo,
          BrandingInfoType.FacebookHandle,
          BrandingInfoType.Email,
          BrandingInfoType.YoutubeHandle,
          BrandingInfoType.TokopediaHandle,
          BrandingInfoType.Website,
          BrandingInfoType.LazadaHandle,
        ]);
      await recipeService.replaceBrandingInfo(
        recipeCopy,
        {
          ...brandingProfile,
          info: [
            ...brandingProfile.info,
            { type: BrandingInfoType.TokopediaHandle, value: "WHATEVER" },
          ],
        },
        "some-ip"
      );

      expect(recipeCopy).not.toMatchObject(recipe);
      expect(recipeCopy.branding.info.data).toMatchObject([
        {
          type: BrandingInfoType.WhatsappNo,
          value: "WHATEVER",
        },
        {
          type: BrandingInfoType.Email,
          value: "WHATEVER",
        },
        {
          type: BrandingInfoType.TokopediaHandle,
          value: "WHATEVER",
        },
      ]);
      expect(recipeCopy.interactions.length).toEqual(
        recipe.interactions.length
      );
    });
  });
});
