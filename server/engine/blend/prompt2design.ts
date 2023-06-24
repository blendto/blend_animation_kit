import { ChatOpenAI } from "langchain/chat_models/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { concat, sampleSize } from "lodash";
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

import { ImageGenerator } from "./imageGenerator";

const TEXT_ONLY_RECIPE_LIST_ID = "p2d-text-only";
const WITH_IMAGE_RECIPE_LIST_ID = "p2d-with-image";

type LLMGenerationReturnType = {
  title: string;
  subtitle: string;
  ctaText: string;
  offerText: string;
  imageDesc?: string;
};

export type SuggestFunction = () => Promise<{
  recipeLists: RecipeList[];
  nextPageKey?: number;
}>;

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
      return concat(
        sampleSize(textOnlyRecipeList.recipes, 2),
        sampleSize(withImageRecipeList.recipes, 2)
      );
    }

    const suggestions = await this.suggestFn();

    const allRecipes = suggestions.recipeLists.flatMap(
      (recipeList) => recipeList.recipes
    );
    return sampleSize(allRecipes, 4);
  }

  async generate(prompt: string) {
    const fileKeys = this.blend.heroImages;

    const chosenRecipes: RecipeVariantId[] = await this.pickRecipes(fileKeys);

    const suggestionPromises = chosenRecipes.map(async (recipeVariantId) => {
      const recipe = await this.recipeService.getRecipeOrFail(
        recipeVariantId.id,
        recipeVariantId.variant
      );
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
      if (illustrativeImageOne && result.imageDesc) {
        const imageGenResult = await this.generateIllustration(
          recipe,
          illustrativeImageOne,
          result.imageDesc
        );
        imageMutations = {
          primaryIllustration: {
            uri: imageGenResult,
            source: "WEB",
          },
        };
      }

      return {
        ...recipeVariantId,
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

  async generateIllustration(
    recipe: Recipe,
    imageRef: ElementRef,
    prompt: string
  ): Promise<string> {
    const interaction = recipe.interactions.find(
      (interaction) =>
        interaction.assetUid === imageRef.uid &&
        interaction.assetType === imageRef.assetType
    );

    const metadata = interaction.metadata as GeometricPositionable;

    return new ImageGenerator().generate({
      prompt,
      aspectRatio: metadata.size,
    });
  }

  async generateWithLLM(
    recipe: Recipe,
    prompt: string
  ): Promise<LLMGenerationReturnType> {
    const chat = new ChatOpenAI({
      openAIApiKey: ConfigProvider.OPENAI_API_KEY,
      temperature: 0.7,
      maxTokens: 256,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      modelName: "gpt-3.5-turbo",
    });

    const { title, subtitle, offerText, ctaText, primaryIllustration } =
      recipe.recipeDetails.elements;

    const thingsToGenerate: Record<string, string> = {};

    if (title) {
      const length = Math.ceil(
        getTextValueFromElement(recipe, title).length * 1.1
      );
      thingsToGenerate.title = `Title of the design, maxLength: ${length}`;
    }

    if (subtitle) {
      const length = Math.ceil(
        getTextValueFromElement(recipe, subtitle).length * 1.2
      );
      thingsToGenerate.subtitle = `Subtitle of the design, maxLength: ${length}`;
    }

    if (offerText) {
      const length = Math.ceil(
        getTextValueFromElement(recipe, offerText).length * 1.4
      );
      thingsToGenerate.offerText = `If any offer mentioned like sale or new, write a text describing that here, else leave it blank, maxLength: ${length}`;
    }

    if (ctaText) {
      const length = Math.ceil(
        getTextValueFromElement(recipe, ctaText).length * 1.4
      );
      thingsToGenerate.ctaText = `Text on the CTA button, maxLength: ${length}`;
    }

    if (primaryIllustration) {
      thingsToGenerate.imageDesc =
        "Description of an illustrative image to include in the design, in english, less than 8 words";
    }

    const parser =
      StructuredOutputParser.fromNamesAndDescriptions(thingsToGenerate);

    const systemPrompt = SystemMessagePromptTemplate.fromTemplate(
      "You are creating the texts that goes into a design that user is trying to create." +
        "\n User will provide with an instruction on what kind of template they are trying to create. You are supposed to generate the values for the keys mentioned. " +
        "Avoid redundancy. Use a Creative tone and write catchy lines." +
        "\n {formatInstructions}"
    );

    const designPrompt = ChatPromptTemplate.fromPromptMessages([
      systemPrompt,
      HumanMessagePromptTemplate.fromTemplate("{text}"),
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
}

function getTextValueFromElement(recipe: Recipe, title: ElementRef): string {
  return recipe.texts.find((text) => text.uid === title.uid)?.value as string;
}
