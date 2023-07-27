import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export class OutputParserException extends Error {
  output?: string;

  constructor(message: string, output?: string) {
    super(message);
    this.output = output;
  }
}

export class MinimalOutputParser<
  T extends z.ZodTypeAny
> extends StructuredOutputParser<T> {
  static fromZodSchema<T extends z.ZodTypeAny>(schema: T) {
    return new this(schema);
  }

  getFormatInstructions(): string {
    return `
        Output should conform to below JSON Schema. Generate less than mentioned character limit. Include the enclosing markdown codeblock:
        \`\`\`json
        ${JSON.stringify(zodToJsonSchema(this.schema))}
        \`\`\`
        `;
  }

  cleanOutput(text: string): string {
    let json = text.includes("```")
      ? text.trim().split(/```(?:json)?/)[1]
      : text.trim();
    const startCharPos = json.indexOf("{");
    if (startCharPos !== 0) {
      json = json.slice(startCharPos);
    }
    const endCharPos = json.indexOf("}");
    if (endCharPos !== json.length - 1) {
      json = json.slice(0, endCharPos + 1).trim();
    }
    return json;
  }

  async parse(text: string): Promise<any> {
    try {
      const json = this.cleanOutput(text);
      return this.schema.parseAsync(JSON.parse(json));
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`,
        text
      );
    }
  }
}
