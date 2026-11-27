import type { AgentRunRepository } from "../ports/agent-run-repository";

export class GetAgentRunPatchQuery {
  constructor(readonly id: string, readonly userId: string) {}
}

export class GetAgentRunPatchHandler {
  constructor(private readonly runs: AgentRunRepository) {}
  async execute(query: GetAgentRunPatchQuery): Promise<string | null> {
    const run = await this.runs.findByIdAndOwner(query.id, query.userId);
    const diff = run?.result.diff;
    return typeof diff === "string" && diff ? diff : null;
  }
}
