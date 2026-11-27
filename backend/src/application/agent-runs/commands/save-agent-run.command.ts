import { AgentRun } from "../../../domain/agent-runs/entities/agent-run";
import type { AgentRunRepository } from "../ports/agent-run-repository";

export class SaveAgentRunCommand {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly prompt: string,
    readonly status: string,
    readonly tasks: unknown[],
    readonly result: Record<string, unknown>,
  ) {}
}

export class SaveAgentRunHandler {
  constructor(private readonly runs: AgentRunRepository) {}
  async execute(command: SaveAgentRunCommand) {
    const run = new AgentRun(command);
    await this.runs.save(run);
  }
}
