import { inject, injectable } from "inversify";
import { IncomingMessage } from "node:http";
import { isEmpty } from "lodash";
import { BrandingRecipe } from "server/base/models/brandingRecipe";
import { ImageFileKeys } from "server/base/models/heroImage";
import {
  Recipe,
  RecipeWrapper,
  RecipeMutations,
} from "server/base/models/recipe";
import { RecipeSource } from "server/base/models/recipeList";
import { fireAndForget } from "server/helpers/async-runner";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { RecipePrepAgent } from "server/engine/blend/recipeAgents";
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
    variant: string;
    fileKeys?: ImageFileKeys;
    source: RecipeSource;
    ip: string;
    uid?: string;
    mutations?: RecipeMutations;
  }): Promise<IncomingMessage> {
    const { source, fileKeys, recipeId, variant, ip, uid, mutations } = args;
    const recipe =
      source === RecipeSource.DEFAULT
        ? await this.recipeService.getRecipeOrFail(recipeId, variant)
        : await this.brandingService.getRecipeOrFail(recipeId, variant);
    const recipeWrapper = new RecipeWrapper(recipe);
    if (!recipe.thumbnail && source === RecipeSource.DEFAULT) {
      // Deprecated. Newer recipe previews are generated synchronously during creation.
      this.saveRecipeThumbnailAsync(
        JSON.parse(JSON.stringify(recipe)) as Recipe | BrandingRecipe
      );
    }

    if (fileKeys) {
      recipeWrapper.replaceHero(fileKeys);
    }

    const recipePrepAgent = new RecipePrepAgent({
      recipe,
      brandingService: this.brandingService,
      recipeService: this.recipeService,
    });

    if (uid) {
      if (!isEmpty(recipe.branding)) {
        await recipePrepAgent.applyBranding(uid, ip);
      }
    }

    if (mutations) {
      await recipePrepAgent.applyMutations(mutations, { dryRun: true });
    }

    return await this.vesapi.previewV2({
      body: recipe,
      schema: ExportRequestSchema.Recipe,
    });
  }
}
