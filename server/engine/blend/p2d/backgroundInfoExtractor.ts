import { ChatOpenAI } from "langchain/chat_models/openai";
import ConfigProvider from "server/base/ConfigProvider";
import { z } from "zod";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

import { MinimalOutputParser, OutputParserException } from "../outputparser";

interface BackgroundInfoLLMResponseType {
  hasUserDescribedImage: boolean;
  userDescribedImage: string;
}

export class BackgroundInfoExtractor {
  chat = new ChatOpenAI({
    openAIApiKey: ConfigProvider.OPENAI_API_KEY,
    temperature: 0.5,
    maxTokens: 256,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    modelName: "gpt-3.5-turbo",
  });

  parser = MinimalOutputParser.fromZodSchema(
    z.object({
      hasUserDescribedImage: z.boolean(),
      userDescribedImage: z.string(),
    })
  );

  systemPrompt = SystemMessagePromptTemplate.fromTemplate(
    "User will describe a design that they are trying to create. " +
      "Your job is to identify if user mentioned details of a background/illustrative image/theme/color scheme or not. " +
      "If yes, extract that information in english." +
      "\n {formatInstructions}"
  );

  async extract(prompt: string): Promise<string | null> {
    const imageDescPrompt = ChatPromptTemplate.fromPromptMessages([
      this.systemPrompt,
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    const response = await this.chat.generatePrompt([
      await imageDescPrompt.formatPromptValue({
        text: prompt,
        formatInstructions: this.parser.getFormatInstructions(),
      }),
    ]);

    try {
      const results = (await this.parser.parse(
        response.generations[0][0].text
      )) as BackgroundInfoLLMResponseType;

      return results.hasUserDescribedImage ? results.userDescribedImage : null;
    } catch (e) {
      if (e instanceof OutputParserException) {
        // Make another call to try and repair it
        const repairPrompt = SystemMessagePromptTemplate.fromTemplate(
          "Format the user provided data into the below schema." +
            "\n {formatInstructions}"
        );

        const imageDescPrompt = ChatPromptTemplate.fromPromptMessages([
          repairPrompt,
          HumanMessagePromptTemplate.fromTemplate("{text}"),
        ]);

        const repairResponse = await this.chat.generatePrompt([
          await imageDescPrompt.formatPromptValue({
            text: response.generations[0][0].text,
            formatInstructions: this.parser.getFormatInstructions(),
          }),
        ]);

        try {
          const output = (await this.parser.parse(
            repairResponse.generations[0][0].text
          )) as BackgroundInfoLLMResponseType;
          return output.hasUserDescribedImage
            ? output.userDescribedImage
            : null;
        } catch (e) {
          // Failed to parse
          return null;
        }
      }
    }
  }
}
