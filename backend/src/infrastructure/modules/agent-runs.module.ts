import { Module } from "@nestjs/common";
import { AGENT_RUN_REPOSITORY, type AgentRunRepository } from "../../application/agent-runs/ports/agent-run-repository";
import { ListAgentRunsHandler } from "../../application/agent-runs/queries/list-agent-runs.query";
import { SaveAgentRunHandler } from "../../application/agent-runs/commands/save-agent-run.command";
import { GetAgentRunPatchHandler } from "../../application/agent-runs/queries/get-agent-run-patch.query";
import { PgAgentRunRepository } from "../persistence/postgres/pg-agent-run.repository";
import { AgentRunsController } from "../http/agent-runs/agent-runs.controller";
import { AuthSessionModule } from "./auth-session.module";

@Module({
  imports: [AuthSessionModule],
  controllers: [AgentRunsController],
  providers: [
    { provide: AGENT_RUN_REPOSITORY, useClass: PgAgentRunRepository },
    {
      provide: ListAgentRunsHandler,
      useFactory: (runs: AgentRunRepository) => new ListAgentRunsHandler(runs),
      inject: [AGENT_RUN_REPOSITORY],
    },
    {
      provide: SaveAgentRunHandler,
      useFactory: (runs: AgentRunRepository) => new SaveAgentRunHandler(runs),
      inject: [AGENT_RUN_REPOSITORY],
    },
    {
      provide: GetAgentRunPatchHandler,
      useFactory: (runs: AgentRunRepository) => new GetAgentRunPatchHandler(runs),
      inject: [AGENT_RUN_REPOSITORY],
    },
  ],
  exports: [AGENT_RUN_REPOSITORY],
})
export class AgentRunsModule {}
