import type { LanguageModel } from "../../application/agents/ports/language-model";
import { callLanguageModel } from "./llm-provider";

export class LanguageModelAdapter implements LanguageModel {
  complete = callLanguageModel;
}
