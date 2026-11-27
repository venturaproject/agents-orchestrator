export const LANGUAGE_MODEL = Symbol("LANGUAGE_MODEL");

export interface LanguageModel {
  complete(system: string, content: string, maxTokens: number): Promise<string>;
}
