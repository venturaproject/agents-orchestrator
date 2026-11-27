export class InvalidAgentRunError extends Error {
  constructor() {
    super("Invalid agent run.");
    this.name = "InvalidAgentRunError";
  }
}
