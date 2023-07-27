import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAI } from "langchain";
import { ZodType, z } from "zod";
import * as async from "async";

import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { concat, sample, sampleSize, shuffle, some } from "lodash";
import ConfigProvider from "server/base/ConfigProvider";
import { Blend } from "server/base/models/blend";
import {
  ElementRef,
  GeometricPositionable,
  Recipe,
  ReplacementTexts,
} from "server/base/models/recipe";
import { RecipeList, RecipeVariantId } from "server/base/models/recipeList";
import { RecipeService } from "server/service/recipe";
import { NonHeroRecipeListService } from "server/service/nonHeroRecipeList";
import { BlendHeroImage } from "server/base/models/heroImage";

import { diContainer } from "inversify.config";
import { AIStudioService } from "server/service/aistudio";
import { TYPES } from "server/types";

import { GenericImageGenerator } from "./p2d/genericImageGenerator";
import { MinimalOutputParser } from "./outputparser";
import { BackgroundInfoExtractor } from "./p2d/backgroundInfoExtractor";

import { StudioImageGenerator } from "./p2d/studioImageGenerator";
import { ImageDescriptionGenerator } from "./p2d/imageDescriptionGenerator";

const TEXT_ONLY_RECIPE_LIST_ID = "p2d-text-only";
const WITH_IMAGE_RECIPE_LIST_ID = "p2d-with-image";

type LLMGenerationReturnType = {
  title: string;
  subtitle: string;
  ctaText: string;
  offerText: string;
};

export type SuggestFunction = () => Promise<{
  recipeLists: RecipeList[];
  nextPageKey?: number;
}>;

export class Prompt2DesignAutocompleter {
  async complete(promptInput: string) {
    const model = new OpenAI({
      openAIApiKey: ConfigProvider.OPENAI_API_KEY,
      temperature: 0.7,
      modelName: "davinci:ft-blend-2023-07-04-15-49-08",
      maxTokens: 100,
      stop: ["\n"],
      n: 2,
      bestOf: 2,
    });

    const template = "Input: {input}\n Output:";
    const prompt = new PromptTemplate({
      template,
      inputVariables: ["input"],
    });

    const formattedPrompt = await prompt.format({ input: promptInput });

    const res = await model.generate([formattedPrompt]);

    return res.generations.flatMap((generation) =>
      generation.map((g) => g.text)
    );
  }
}

export default class Prompt2DesignGenerator {
  recipeService: RecipeService;
  nonHeroRecipeListService: NonHeroRecipeListService;
  blend: Blend;

  suggestFn: SuggestFunction;

  constructor({
    blend,
    recipeService,
    nonHeroRecipeService,
    suggestFn,
  }: {
    blend: Blend;
    recipeService: RecipeService;
    nonHeroRecipeService: NonHeroRecipeListService;
    suggestFn: SuggestFunction;
  }) {
    this.blend = blend;
    this.recipeService = recipeService;
    this.nonHeroRecipeListService = nonHeroRecipeService;
    this.suggestFn = suggestFn;
  }

  async pickRecipes(fileKeys: BlendHeroImage) {
    if (!fileKeys) {
      const [textOnlyRecipeList, withImageRecipeList] = await Promise.all([
        this.nonHeroRecipeListService.get(TEXT_ONLY_RECIPE_LIST_ID),
        this.nonHeroRecipeListService.get(WITH_IMAGE_RECIPE_LIST_ID),
      ]);
      return shuffle(
        concat(
          sampleSize(textOnlyRecipeList.recipes, 4),
          sampleSize(withImageRecipeList.recipes, 4)
        )
      );
    }

    const suggestions = await this.suggestFn();

    const allRecipes = suggestions.recipeLists
      .slice(0, 4)
      .flatMap((recipeList) => recipeList.recipes);

    return sampleSize(allRecipes, 8);
  }

  async generate({ prompt, reqUid }: { prompt: string; reqUid: string }) {
    const fileKeys = this.blend.heroImages;

    const chosenRecipeIds: RecipeVariantId[] = await this.pickRecipes(fileKeys);

    const chosenRecipes = await async.map(
      chosenRecipeIds,
      async (recipeVariantId: RecipeVariantId) =>
        await this.recipeService.getRecipeOrFail(
          recipeVariantId.id,
          recipeVariantId.variant
        )
    );

    const descriptions: string[] = await this.generateDescriptionsIfNecessary(
      prompt,
      chosenRecipes
    );

    const backgroundDescription: string =
      await this.extractBackgroundInformation(prompt);

    const suggestionPromises = chosenRecipes.map(async (recipe: Recipe) => {
      let result: LLMGenerationReturnType;
      try {
        result = await this.generateWithLLM(recipe, prompt);
      } catch (e) {
        // Ignoring the failure, expect to provide 1 less design
        return null;
      }
      const { primaryIllustration: illustrativeImageOne } =
        recipe.recipeDetails.elements;

      let imageMutations: object = null;
      if (illustrativeImageOne) {
        const imageGenResult = await this.generateIllustration({
          recipe,
          imageRef: illustrativeImageOne,
          descriptions,
          backgroundDescription,
          blend: this.blend,
          reqUid,
        });
        if (imageGenResult) {
          imageMutations = {
            primaryIllustration: {
              uri: imageGenResult,
              source: "WEB",
            },
          };
        }
      }

      return {
        id: recipe.id,
        variant: recipe.variant,
        replacementTexts: this.cleanReplacementTexts(result),
        mutations: {
          texts: this.cleanReplacementTexts(result),
          images: imageMutations,
        },
      };
    });

    return (await Promise.all(suggestionPromises)).filter(
      (suggestion) => !!suggestion
    );
  }

  extractBackgroundInformation(prompt: string): Promise<string | null> {
    return new BackgroundInfoExtractor().extract(prompt);
  }

  async generateIllustration({
    recipe,
    imageRef,
    descriptions,
    backgroundDescription,
    blend,
    reqUid,
  }: {
    recipe: Recipe;
    imageRef: ElementRef;
    descriptions: string[];
    backgroundDescription: string | null;
    blend: Blend;
    reqUid: string;
  }): Promise<string> {
    const interaction = recipe.interactions.find(
      (interaction) =>
        interaction.assetUid === imageRef.uid &&
        interaction.assetType === imageRef.assetType
    );

    const metadata = interaction.metadata as GeometricPositionable;

    if (blend.heroImages) {
      const aiStudioService = diContainer.get<AIStudioService>(
        TYPES.AIStudioService
      );

      return new StudioImageGenerator(aiStudioService).generate({
        promptText: backgroundDescription,
        aspectRatio: metadata.size,
        blend,
        uid: reqUid,
      });
    }

    const chosenPrompt = sample(descriptions);
    if (!chosenPrompt) return null;

    return new GenericImageGenerator().generate({
      prompt: chosenPrompt,
      aspectRatio: metadata.size,
    });
  }

  async generateWithLLM(
    recipe: Recipe,
    prompt: string
  ): Promise<LLMGenerationReturnType> {
    const chat = new ChatOpenAI({
      openAIApiKey: ConfigProvider.OPENAI_API_KEY,
      temperature: 0.5,
      maxTokens: 256,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      modelName: "gpt-3.5-turbo",
      stop: ["<|endoftext|>"],
    });

    const { title, subtitle, offerText, ctaText } =
      recipe.recipeDetails.elements;

    const thingsToGenerate: Record<string, ZodType> = {};

    if (title) {
      const length = Math.ceil(getTextValueFromElement(recipe, title).length);
      thingsToGenerate.title = z
        .string()
        .optional()
        .describe(`Title of the design, under ${length} chars`);
    }

    if (subtitle) {
      const length = Math.ceil(
        getTextValueFromElement(recipe, subtitle).length
      );
      thingsToGenerate.subtitle = z
        .string()
        .optional()
        .describe(`Subtitle of the design, under ${length} chars`);
    }

    if (offerText) {
      const length = Math.ceil(
        getTextValueFromElement(recipe, offerText).length
      );
      thingsToGenerate.offerText = z
        .string()
        .optional()
        .describe(`The offer mentioned by the user, under ${length} chars`);
    }

    if (ctaText) {
      const length = Math.ceil(getTextValueFromElement(recipe, ctaText).length);
      thingsToGenerate.ctaText = z
        .string()
        .optional()
        .describe(`Text on the CTA button, under ${length} chars`);
    }

    const parser = MinimalOutputParser.fromZodSchema(
      z.object(thingsToGenerate)
    );

    const systemPrompt = SystemMessagePromptTemplate.fromTemplate(
      "You are creating the texts that goes into a design that user is trying to create." +
        "\n User will provide with an instruction on what kind of template they are trying to create. You are supposed to generate the values for the keys mentioned. " +
        "Generate Text in the same language that user's instruction is in." +
        "Avoid redundancy. Use a Creative tone and write catchy lines." +
        `Random seed: ${Math.random()}` +
        "\n {formatInstructions}"
    );

    const designPrompt = ChatPromptTemplate.fromPromptMessages([
      systemPrompt,
      HumanMessagePromptTemplate.fromTemplate("{text} <|endoftext|>"),
    ]);

    const response = await chat.generatePrompt([
      await designPrompt.formatPromptValue({
        formatInstructions: parser.getFormatInstructions(),
        text: prompt,
      }),
    ]);

    return (await parser.parse(
      response.generations[0][0].text
    )) as LLMGenerationReturnType;
  }

  cleanReplacementTexts = (texts: ReplacementTexts) => {
    // Clean all the values, if they are empty, return null
    const allowedKeys = ["title", "subtitle", "ctaText", "offerText"];

    const cleanedTexts = Object.entries(texts).reduce(
      (acc, [key, value]: [string, string]) => {
        if (value.trim().length === 0 || !allowedKeys.includes(key)) {
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

  async generateDescriptionsIfNecessary(
    prompt: string,
    recipes: Recipe[]
  ): Promise<string[]> {
    const someRecipesNeedsImages = some(
      recipes,
      (recipe) => !!recipe.recipeDetails?.elements?.primaryIllustration
    );

    if (someRecipesNeedsImages) {
      try {
        return (
          (await new ImageDescriptionGenerator().generate({ prompt }))
            ?.descriptions ?? []
        );
      } catch (e) {
        // Ignoring the failure, we will just use stock images
        return [];
      }
    }
  }
}

function getTextValueFromElement(recipe: Recipe, title: ElementRef): string {
  return recipe.texts.find((text) => text.uid === title.uid)?.value as string;
}
