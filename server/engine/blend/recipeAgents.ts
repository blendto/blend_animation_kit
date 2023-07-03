import {
  BrandingReplacements,
  ElementSource,
  ImageReplacements,
  Recipe,
  RecipeMutations,
  RecipeWrapper,
  ReplacementTexts,
} from "server/base/models/recipe";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { BlendService } from "server/service/blend";
import BrandingService from "server/service/branding";
import { RecipeService } from "server/service/recipe";

export interface RecipePrepParams {
  recipe: Recipe;
  recipeService: RecipeService;
  brandingService: BrandingService;
}

export interface RecipeChoosePrepParams extends RecipePrepParams {
  blendId: string;
  blendService: BlendService;
}

interface ApplyMutationsOptions {
  dryRun?: boolean;
}

export class RecipePrepAgent {
  recipe: Recipe;
  recipeService: RecipeService;
  brandingService: BrandingService;

  constructor({ recipe, recipeService, brandingService }: RecipePrepParams) {
    this.recipe = recipe;
    this.recipeService = recipeService;
    this.brandingService = brandingService;
  }

  async applyBranding(uid: string, ip?: string) {
    const recipeWrapper = new RecipeWrapper(this.recipe);
    const brandingProfile = await this.brandingService.get(uid);
    if (brandingProfile) {
      await this.recipeService.replaceBrandingInfo(
        this.recipe,
        brandingProfile,
        ip
      );
    } else {
      recipeWrapper.cleanupBranding();
    }
  }

  protected async applyTextMutations(texts: ReplacementTexts, dryRun: boolean) {
    const recipeWrapper = new RecipeWrapper(this.recipe);
    // Initial mutation to fit the text
    recipeWrapper.mutateTexts(texts);
    if (dryRun) {
      return;
    }
    const response = await new VesApi().fitText({
      body: this.recipe,
      schema: ExportRequestSchema.Recipe,
    });
    // Final mutation to fit the text
    recipeWrapper.mutateTexts(texts, response.textUpdates);
  }

  protected async applyImageMutations(images: ImageReplacements) {
    const recipeWrapper = new RecipeWrapper(this.recipe);

    recipeWrapper.mutateImages(images);

    // Blank promise so that inherited classes can be async
    await Promise.resolve();
  }

  protected async applyBrandingMutations(branding: BrandingReplacements) {
    if (branding?.logo && this.recipe.branding?.logo) {
      this.recipe.branding.logo.data.source = ElementSource.web;
      this.recipe.branding.logo.data.uri = branding.logo;
    }

    // Blank promise so that inherited classes can be async
    await Promise.resolve();
  }

  async applyMutations(
    mutations: RecipeMutations,
    opts?: ApplyMutationsOptions
  ) {
    const { texts, images, branding } = mutations;
    if (texts) {
      await this.applyTextMutations(texts, opts?.dryRun ?? false);
    }

    if (images) {
      await this.applyImageMutations(images);
    }

    if (branding) {
      await this.applyBrandingMutations(branding);
    }
  }
}

export class RecipeChoosePrepAgent extends RecipePrepAgent {
  blendId: string;
  blendService: BlendService;

  constructor({ blendId, blendService, ...others }: RecipeChoosePrepParams) {
    super(others);
    this.blendId = blendId;
    this.blendService = blendService;
  }

  protected async applyImageMutations(images: ImageReplacements) {
    const { primaryIllustration } = images;

    if (primaryIllustration) {
      if (primaryIllustration.source !== "WEB") {
        throw new Error(
          "Unsupported image source: " + primaryIllustration.source
        );
      }
      const fileKey = await this.blendService.uploadFileToBlend({
        blendId: this.blendId,
        fileUrl: images.primaryIllustration.uri,
      });
      images.primaryIllustration = {
        uri: fileKey,
        source: ElementSource.blend,
      };
    }

    await super.applyImageMutations(images);
  }
}
