import "reflect-metadata";
import {
  RecipeList,
  RecipeSource,
  RecipeVariantId,
  SavedRecipeSuggestions,
} from "server/base/models/recipeList";
import { BlendService } from "server/service/blend";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import { ObjectNotFoundError, UserError } from "server/base/errors";
import RecoEngineApi, { StyleSuggestions } from "server/internal/reco-engine";
import { FlowType, Recipe } from "server/base/models/recipe";
import { ImageFileKeys } from "server/base/models/heroImage";
import { UserService } from "server/service/user";
import ConfigProvider from "server/base/ConfigProvider";
import { DaxDB } from "server/external/dax";
import Prompt2DesignGenerator, {
  Prompt2DesignAutocompleter,
  SuggestFunction,
} from "server/engine/blend/prompt2design";

import BrandingService from "./branding";
import { RecipeService } from "./recipe";
import { NonHeroRecipeListService } from "./nonHeroRecipeList";

@injectable()
export class SuggestionService {
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.UserService) userService: UserService;
  @inject(TYPES.BrandingService) brandingService: BrandingService;
  @inject(TYPES.DaxDB) daxStore: DaxDB;
  @inject(TYPES.RecipeService) recipeService: RecipeService;
  @inject(TYPES.NonHeroRecipeListService)
  nonHeroRecipeListService: NonHeroRecipeListService;

  recoEngineApi = new RecoEngineApi();

  async selectFileKeysFromBatchPreview(
    uid: string,
    batchId: string
  ): Promise<ImageFileKeys> {
    const blendIds = await this.blendService.getBlendIdsForBatch(batchId);
    const blendId = blendIds[0];
    if (!blendId) {
      throw new UserError(`No blends for batch ${batchId}`);
    }

    const blend = await this.blendService.getBlend(blendId);
    if (!blend.heroImages?.withoutBg) {
      throw new UserError(
        `Blend ${blendId} does not have bg-removed hero image`
      );
    }
    return blend.heroImages;
  }

  async suggestBatchRecipes(
    buildVersion: number,
    uid: string,
    batchId: string,
    ip: string,
    flowType: FlowType = FlowType.BATCH
  ): Promise<RecipeList[]> {
    const heroImages = await this.selectFileKeysFromBatchPreview(uid, batchId);
    return (
      await this.suggestRecipes(
        buildVersion,
        uid,
        heroImages.withoutBg,
        ip,
        flowType
      )
    ).recipeLists;
  }

  /**
   * @deprecated Use `suggestRecipesPaginated`
   */
  async suggestRecipes(
    buildVersion: number,
    uid: string,
    fileKey: string,
    ip: string,
    flow: FlowType
  ): Promise<{ recipeLists: RecipeList[]; randomTemplates: string[] }> {
    let recipeLists = (
      await this.recoEngineApi.suggestRecipeLists(
        fileKey,
        this.userService.getUserAgent(ip),
        flow
      )
    ).suggestedRecipeCategories;

    recipeLists.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    );

    if (flow !== FlowType.BATCH_360) {
      // For everything except batch 360, add recents
      recipeLists = await this.blendService.addRecentsToRecipeLists(
        uid,
        recipeLists
      );
    }

    recipeLists = await this.brandingService.addToRecipeLists(
      buildVersion,
      uid,
      recipeLists
    );

    // For backward compatibility, use recipes to fill 9:16 ones in recipeIds
    recipeLists.forEach((list) => {
      list.recipeIds = list.recipes
        // eslint-disable-next-line eqeqeq
        .filter(({ variant }) => variant == "9:16")
        .map(({ id }) => id);
    });

    // For Backwards compatibility
    const randomTemplates = [];

    return { recipeLists, randomTemplates };
  }

  async suggestRecipesPaginated(
    requestBody: SuggestRecipePaginatedRequestBody
  ): Promise<{ recipeLists: RecipeList[]; nextPageKey?: number }> {
    const {
      buildVersion,
      uid,
      fileKey,
      ip,
      pageKey,
      productSuperCategory,
      filters,
      flow,
      include,
      entriesRequested,
    } = requestBody;
    const suggestions = await this.recoEngineApi.suggestRecipeListsPaginated({
      heroImageKey: fileKey,
      userAgentPromise: this.userService.getUserAgent(ip),
      pageKey,
      productSuperCategory,
      filters,
      flow,
      entriesRequested,
    });

    let recipeLists = suggestions.suggestedRecipeCategories;

    recipeLists.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    );

    if (!pageKey) {
      if (include.includes(SuggestInclusions.RECENTS)) {
        recipeLists = await this.blendService.addRecentsToRecipeLists(
          uid,
          recipeLists
        );
      }
      if (include.includes(SuggestInclusions.BRANDING)) {
        recipeLists = await this.brandingService.addToRecipeLists(
          buildVersion,
          uid,
          recipeLists
        );
      }
    }

    return { recipeLists, nextPageKey: suggestions.nextPageKey };
  }

  async suggestHomePageRecipes(): Promise<RecipeList[]> {
    const { data: suggestions } = (await this.daxStore.getItem({
      TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
      Key: { key: "home_page_recipes", version: "1" },
    })) as { data: SavedRecipeSuggestions };

    const suggestionPromises = suggestions.common.map((list) =>
      this.recipeListMapper(list)
    );
    suggestions.common = await Promise.all(suggestionPromises);

    return suggestions.common;
  }

  async suggestStyles(fileKey: string, ip: string): Promise<StyleSuggestions> {
    const suggestions = await this.recoEngineApi.suggestStyles(
      fileKey,
      this.userService.getUserAgent(ip)
    );
    suggestions.styleSuggestions = suggestions.styleSuggestions.map((s) => ({
      colorPalette: s.colorPalette,
    }));
    return suggestions;
  }

  async recipeListMapper(list: RecipeList): Promise<RecipeList> {
    const promises = list.recipes.map((recipe) => {
      if (recipe.source === RecipeSource.BRANDING) {
        return recipe;
      }
      return this.backfillRecipeDetails(recipe);
    });
    list.recipes = await Promise.all(promises);
    return list;
  }

  async backfillRecipeDetails(
    recipeVariantId: RecipeVariantId
  ): Promise<RecipeVariantId> {
    const { id, variant, source = RecipeSource.DEFAULT } = recipeVariantId;

    const recipe =
      source === RecipeSource.DEFAULT
        ? ((await this.daxStore.getItem({
            TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
            Key: { id, variant },
          })) as Recipe)
        : await this.brandingService.getRecipeOrFail(id, variant);

    const { title, thumbnail, applicableFor } = recipe;
    recipeVariantId.source = source;
    recipeVariantId.extra = {
      title,
      thumbnail,
      isPremium: recipe.recipeDetails.isPremium,
      applicableFor,
    };

    return recipeVariantId;
  }

  async autocompletePrompt({ prompt }: AutocompletePromptParams) {
    return new Prompt2DesignAutocompleter().complete(prompt);
  }

  async prompt2design(req: Prompt2DesignRequestBody) {
    const blend = await this.blendService.getBlend(req.id, {
      consistentRead: true,
    });

    if (!blend) {
      throw new ObjectNotFoundError(`Blend ${req.id} not found`);
    }

    const fileKeys = blend.heroImages;

    const generator = new Prompt2DesignGenerator({
      blend,
      recipeService: this.recipeService,
      nonHeroRecipeService: this.nonHeroRecipeListService,
      suggestFn: this.suggestRecipesPaginated.bind(this, {
        buildVersion: req.buildVersion,
        uid: req.uid,
        fileKey: fileKeys?.withoutBg,
        ip: req.ip,
        productSuperCategory:
          blend.heroImages?.classificationMetadata?.productSuperClass,
        flow: FlowType.PROMPT_TO_DESIGN,
        include: [],
        entriesRequested: 10,
      }) as SuggestFunction,
    });

    return generator.generate({ prompt: req.prompt, reqUid: req.uid });
  }
}

interface SuggestRecipePaginatedRequestBody {
  buildVersion: number;
  uid: string;
  fileKey: string;
  ip: string;
  pageKey?: number;
  productSuperCategory?: string;
  filters?: Record<string, unknown>;
  flow: FlowType;
  include: SuggestInclusions[];
  entriesRequested?: number;
}

export enum SuggestInclusions {
  RECENTS = "RECENTS",
  BRANDING = "BRANDING",
}

interface Prompt2DesignRequestBody {
  buildVersion: number;
  uid: string;
  ip: string;
  id: string;
  prompt: string;
}

interface AutocompletePromptParams {
  prompt: string;
}
