export type AgentRunProperties = {
  id: string;
  userId: string;
  prompt: string;
  status: string;
  tasks: unknown[];
  result: Record<string, unknown>;
};

export class AgentRun {
  readonly id: string;
  readonly userId: string;
  readonly prompt: string;
  readonly status: string;
  readonly tasks: unknown[];
  readonly result: Record<string, unknown>;

  constructor(properties: AgentRunProperties) {
    if (
      !/^[0-9a-f-]{36}$/i.test(properties.id) ||
      !properties.userId ||
      typeof properties.userId !== "string" ||
      typeof properties.prompt !== "string" ||
      properties.prompt.length > 2000 ||
      typeof properties.status !== "string" ||
      !properties.status.trim() ||
      !Array.isArray(properties.tasks)
    ) {
      throw new InvalidAgentRunError();
    }
    this.id = properties.id;
    this.userId = properties.userId;
    this.prompt = properties.prompt;
    this.status = properties.status;
    this.tasks = properties.tasks;
    this.result = properties.result && typeof properties.result === "object" && !Array.isArray(properties.result)
      ? properties.result
      : {};
  }
}
import { InvalidAgentRunError } from "../errors/invalid-agent-run.error";
