import { inject, injectable } from "inversify";
import { isEmpty } from "lodash";
import { BrandingRecipe } from "server/base/models/brandingRecipe";
import { ImageFileKeys } from "server/base/models/heroImage";
import { Recipe, RecipeWrapper } from "server/base/models/recipe";
import { RecipeSource } from "server/base/models/recipeList";
import { fireAndForget } from "server/helpers/async-runner";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { TYPES } from "server/types";
import { IService } from ".";
import BrandingService from "./branding";
import { RecipeService } from "./recipe";

@injectable()
export class PreviewService implements IService {
  @inject(TYPES.RecipeService) recipeService: RecipeService;
  @inject(TYPES.BrandingService) brandingService: BrandingService;
  vesapi = new VesApi();

  saveRecipeThumbnailAsync(recipe: Recipe) {
    fireAndForget(() => this.recipeService.saveRecipeThumbnail(recipe), {
      operationName: "SAVING_RECIPE_THUMBNAIL",
    }).catch(() => {});
  }

  async generate(args: {
    recipeId: string;
    variant?: string;
    fileKeys: ImageFileKeys;
    source: RecipeSource;
    ip: string;
    uid?: string;
  }) {
    const recipe =
      args.source === RecipeSource.DEFAULT
        ? await this.recipeService.getRecipeOrFail(args.recipeId, args.variant)
        : await this.brandingService.getRecipeOrFail(
            args.recipeId,
            args.variant
          );
    const recipeWrapper = new RecipeWrapper(recipe);
    if (!recipe.thumbnail && args.source === RecipeSource.DEFAULT) {
      // Deprecated. Newer recipe previews are generated synchronously during creation.
      this.saveRecipeThumbnailAsync(
        JSON.parse(JSON.stringify(recipe)) as Recipe | BrandingRecipe
      );
    }

    recipeWrapper.replaceHero(args.fileKeys);
    if (args.uid) {
      if (!isEmpty(recipe.branding)) {
        const brandingProfile = await this.brandingService.get(args.uid);
        if (brandingProfile) {
          await this.recipeService.replaceBrandingInfo(
            recipe,
            brandingProfile,
            args.ip
          );
        } else {
          recipeWrapper.cleanupBranding();
        }
      }
    }

    return await this.vesapi.previewV2({
      body: recipe,
      schema: ExportRequestSchema.Recipe,
    });
  }
}
