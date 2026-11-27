export class AgentRunNotFoundError extends Error {
  constructor() {
    super("Agent run not found.");
    this.name = "AgentRunNotFoundError";
  }
}
