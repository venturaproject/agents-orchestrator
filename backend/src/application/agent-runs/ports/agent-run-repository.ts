import type { AgentRun } from "../../../domain/agent-runs/entities/agent-run";

export const AGENT_RUN_REPOSITORY = Symbol("AGENT_RUN_REPOSITORY");

export type AgentRunView = {
  id: string;
  prompt: string;
  status: string;
  tasks: unknown[];
  result: Record<string, unknown>;
  createdAt: Date | string;
};

export interface AgentRunRepository {
  listByOwner(userId: string): Promise<AgentRunView[]>;
  save(run: AgentRun): Promise<void>;
  findByIdAndOwner(id: string, userId: string): Promise<AgentRunView | null>;
}
