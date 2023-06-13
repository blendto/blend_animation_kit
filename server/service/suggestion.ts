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
import { FlowType, Recipe, ReplacementTexts } from "server/base/models/recipe";
import { ImageFileKeys } from "server/base/models/heroImage";
import { UserService } from "server/service/user";
import ConfigProvider from "server/base/ConfigProvider";
import { DaxDB } from "server/external/dax";
import { sampleSize } from "lodash";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from "langchain/prompts";

import BrandingService from "./branding";

@injectable()
export class SuggestionService {
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.UserService) userService: UserService;
  @inject(TYPES.BrandingService) brandingService: BrandingService;
  @inject(TYPES.DaxDB) daxStore: DaxDB;
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
    ip: string
  ): Promise<RecipeList[]> {
    const heroImages = await this.selectFileKeysFromBatchPreview(uid, batchId);
    return (
      await this.suggestRecipes(
        buildVersion,
        uid,
        heroImages.withoutBg,
        ip,
        FlowType.BATCH
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

    recipeLists = await this.blendService.addRecentsToRecipeLists(
      uid,
      recipeLists
    );
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
    } = requestBody;
    const suggestions = await this.recoEngineApi.suggestRecipeListsPaginated({
      heroImageKey: fileKey,
      userAgentPromise: this.userService.getUserAgent(ip),
      pageKey,
      productSuperCategory,
      filters,
      flow,
    });

    let recipeLists = suggestions.suggestedRecipeCategories;

    recipeLists.sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    );

    if (!pageKey) {
      recipeLists = await this.blendService.addRecentsToRecipeLists(
        uid,
        recipeLists
      );
      recipeLists = await this.brandingService.addToRecipeLists(
        buildVersion,
        uid,
        recipeLists
      );
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

  async prompt2design(req: Prompt2DesignRequestBody) {
    const blend = await this.blendService.getBlend(req.id, {
      consistentRead: true,
    });

    if (!blend) {
      throw new ObjectNotFoundError(`Blend ${req.id} not found`);
    }
    const fileKeys = blend.heroImages;

    const suggestions = await this.suggestRecipesPaginated({
      buildVersion: req.buildVersion,
      uid: req.uid,
      fileKey: fileKeys.withoutBg,
      ip: req.ip,
      flow: FlowType.PROMPT_TO_DESIGN,
    });

    const allRecipes = suggestions.recipeLists.flatMap(
      (recipeList) => recipeList.recipes
    );

    // Choose 4 random from allRecipes
    const randomRecipes = sampleSize(allRecipes, 4);

    const suggestionPromises = randomRecipes.map(async (recipe) => {
      const chat = new ChatOpenAI({
        openAIApiKey: ConfigProvider.OPENAI_API_KEY,
        temperature: 0.7,
        maxTokens: 256,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      });

      const parser = StructuredOutputParser.fromNamesAndDescriptions({
        title: "Title of the design",
        subtitle: "Subtitle of the design",
        ctaText: "Text on the CTA button",
        offerText:
          "If any offer mentioned like sale or new, write a text describing that here, else leave it blank, maxLength: 12",
      });

      const systemPrompt = SystemMessagePromptTemplate.fromTemplate(
        "You are creating the texts that goes into a design that user is trying to create." +
          "\n User will provide with an instruction on what kind of template they are trying to create. You are supposed to generate the values for the keys mentioned." +
          "\n {formatInstructions}"
      );

      const designPrompt = ChatPromptTemplate.fromPromptMessages([
        systemPrompt,
        HumanMessagePromptTemplate.fromTemplate("{text}"),
      ]);

      const response = await chat.generatePrompt([
        await designPrompt.formatPromptValue({
          formatInstructions: parser.getFormatInstructions(),
          text: req.prompt,
        }),
      ]);

      try {
        return {
          ...recipe,
          replacementTexts: this.cleanReplacementTexts(
            await parser.parse(response.generations[0][0].text)
          ),
        };
      } catch (e) {
        // Ignoring the failure, expect to provide 1 less design
        return null;
      }
    });

    const validSuggestions = (await Promise.all(suggestionPromises)).filter(
      (suggestion) => !!suggestion
    );

    return validSuggestions;
  }

  cleanReplacementTexts = (texts: ReplacementTexts) => {
    // Clean all the values, if they are empty, return null
    const cleanedTexts = Object.entries(texts).reduce(
      (acc, [key, value]: [string, string]) => {
        if (value.trim().length === 0) {
          return acc;
        }
        return {
          ...acc,
          [key]: value.trim(),
        };
      },
      {} as ReplacementTexts
    );
    return cleanedTexts;
  };
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
}

interface Prompt2DesignRequestBody {
  buildVersion: number;
  uid: string;
  ip: string;
  id: string;
  prompt: string;
}
