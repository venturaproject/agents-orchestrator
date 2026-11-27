export class AgentProviderUnavailableError extends Error {
  constructor() {
    super("No language-model provider is configured.");
    this.name = "AgentProviderUnavailableError";
  }
}
