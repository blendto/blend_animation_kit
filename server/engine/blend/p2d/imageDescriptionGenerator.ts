import { ChatOpenAI } from "langchain/chat_models/openai";
import ConfigProvider from "server/base/ConfigProvider";
import { z } from "zod";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

import { MinimalOutputParser, OutputParserException } from "../outputparser";

type ImageGenerationOptions = {
  prompt: string;
};

type ImageDescriptionsLLMGenerationReturnType = {
  descriptions: string[];
};

export class ImageDescriptionGenerator {
  async generate({ prompt }: ImageGenerationOptions) {
    const chat = new ChatOpenAI({
      openAIApiKey: ConfigProvider.OPENAI_API_KEY,
      temperature: 0.7,
      maxTokens: 256,
      topP: 0.85,
      frequencyPenalty: 0,
      presencePenalty: 0,
      modelName: "gpt-3.5-turbo",
      stop: ["<|endoftext|>"],
    });

    const parser = MinimalOutputParser.fromZodSchema(
      z.object({
        descriptions: z.array(z.string()),
      })
    );

    const systemPrompt = SystemMessagePromptTemplate.fromTemplate(
      `User is trying to describe a graphic design in any language. Your job is to describe feature image or background image in english for the graphic design they are trying to create. Images should not have text like dates, or discount percentage. Limited words. No verb. Provide a object with array of 5 suggestions in english each less than 8 words as mentioned below. Translate to english if it is not.

Output should conform to below JSON Schema. Generate less than mentioned character limit. Include the enclosing markdown codeblock:

{formatInstructions}

Examples:
Input: 15% de descuento en las marcas Vichy y La Roche-Posay del 24 de julio al 28 de julio.
Output:
\`\`\`json
{{"descriptions": ["Closeup shot of a white woman with fair skin","Skincare bottles and tubes","Close up shot of face of a black woman with great skin","top view of a bottle of skin care product open and scooped","Close up shot of a man applying a face cream"]}}
\`\`\`

Input: Nail Salon opening
Output:
\`\`\`json
{{"descriptions": ["Interiors of a modern well lit nail salon","Close up shot of nails with nail polish applied","A bunch of nail products kept on a marble slab","nail polish bottles, nail files, cuticle creams","close-up images of beautifully manicured hands"]}}
\`\`\``
    );

    const imageDescPrompt = ChatPromptTemplate.fromPromptMessages([
      systemPrompt,
      HumanMessagePromptTemplate.fromTemplate("{text} <|endoftext|>"),
    ]);

    const response = await chat.generatePrompt([
      await imageDescPrompt.formatPromptValue({
        text: prompt,
        formatInstructions: parser.getFormatInstructions(),
      }),
    ]);

    try {
      const results = (await parser.parse(
        response.generations[0][0].text
      )) as ImageDescriptionsLLMGenerationReturnType;

      return results;
    } catch (e) {
      if (e instanceof OutputParserException) {
        // Make another call to try and repair it
        const repairPrompt = SystemMessagePromptTemplate.fromTemplate(
          "Format the user provided list into the below schema." +
            "\n {formatInstructions}"
        );

        const imageDescPrompt = ChatPromptTemplate.fromPromptMessages([
          repairPrompt,
          HumanMessagePromptTemplate.fromTemplate("{text}"),
        ]);

        const repairResponse = await chat.generatePrompt([
          await imageDescPrompt.formatPromptValue({
            text: response.generations[0][0].text,
            formatInstructions: parser.getFormatInstructions(),
          }),
        ]);

        const output = (await parser.parse(
          repairResponse.generations[0][0].text
        )) as ImageDescriptionsLLMGenerationReturnType;

        return output;
      }
    }
  }
}
