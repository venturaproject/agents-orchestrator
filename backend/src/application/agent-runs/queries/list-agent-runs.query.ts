import type { AgentRunRepository } from "../ports/agent-run-repository";

export class ListAgentRunsQuery {
  constructor(readonly userId: string) {}
}

export class ListAgentRunsHandler {
  constructor(private readonly runs: AgentRunRepository) {}
  execute(query: ListAgentRunsQuery) {
    return this.runs.listByOwner(query.userId);
  }
}
