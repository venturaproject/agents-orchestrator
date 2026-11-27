import type { AgentRunRepository, AgentRunView } from "../../../application/agent-runs/ports/agent-run-repository";
import type { AgentRun } from "../../../domain/agent-runs/entities/agent-run";
import { pgPool } from "./pg-pool";

type RunRow = {
  id: string;
  prompt: string;
  status: string;
  tasks: unknown[];
  result: Record<string, unknown>;
  createdAt: Date;
};

function mapRun(row: RunRow): AgentRunView {
  return {
    id: row.id,
    prompt: row.prompt,
    status: row.status,
    tasks: row.tasks,
    result: row.result,
    createdAt: row.createdAt,
  };
}

export class PgAgentRunRepository implements AgentRunRepository {
  async listByOwner(userId: string): Promise<AgentRunView[]> {
    const { rows } = await pgPool.query<RunRow>(
      `select id, prompt, status, tasks, result, created_at as "createdAt"
       from agent_runs where user_id = $1 order by created_at desc limit 100`,
      [userId],
    );
    return rows.map(mapRun);
  }

  async save(run: AgentRun): Promise<void> {
    await pgPool.query(
      `insert into agent_runs (id, user_id, prompt, status, tasks, result)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       on conflict (id) do update set status = excluded.status, tasks = excluded.tasks,
         result = excluded.result
       where agent_runs.user_id = excluded.user_id`,
      [run.id, run.userId, run.prompt, run.status, JSON.stringify(run.tasks), JSON.stringify(run.result)],
    );
  }

  async findByIdAndOwner(id: string, userId: string): Promise<AgentRunView | null> {
    const { rows } = await pgPool.query<RunRow>(
      `select id, prompt, status, tasks, result, created_at as "createdAt"
       from agent_runs where id = $1 and user_id = $2 limit 1`,
      [id, userId],
    );
    return rows[0] ? mapRun(rows[0]) : null;
  }
}
