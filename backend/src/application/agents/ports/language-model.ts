export const LANGUAGE_MODEL = Symbol("LANGUAGE_MODEL");

export type LanguageModelOutputFormat = "text" | "json";

export interface LanguageModel {
  complete(
    system: string,
    content: string,
    maxTokens: number,
    format?: LanguageModelOutputFormat,
  ): Promise<string>;
}
