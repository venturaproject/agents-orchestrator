import { Module } from "@nestjs/common";
import { AGENT_RUN_REPOSITORY, type AgentRunRepository } from "../../application/agent-runs/ports/agent-run-repository";
import { AGENT_WORKSPACE, type AgentWorkspace } from "../../application/agents/ports/agent-workspace";
import { LANGUAGE_MODEL, type LanguageModel } from "../../application/agents/ports/language-model";
import { ExecuteAgentWorkflowHandler } from "../../application/agents/commands/execute-agent-workflow.handler";
import { AgentsController } from "../http/agents/agents.controller";
import { AgentWorkspaceAdapter } from "../agents/agent-workspace.adapter";
import { LanguageModelAdapter } from "../providers/language-model.adapter";
import { AuthSessionModule } from "./auth-session.module";
import { AgentRunsModule } from "./agent-runs.module";

@Module({
  imports: [AuthSessionModule, AgentRunsModule],
  controllers: [AgentsController],
  providers: [
    { provide: AGENT_WORKSPACE, useClass: AgentWorkspaceAdapter },
    { provide: LANGUAGE_MODEL, useClass: LanguageModelAdapter },
    {
      provide: ExecuteAgentWorkflowHandler,
      useFactory: (
        runs: AgentRunRepository,
        workspace: AgentWorkspace,
        languageModel: LanguageModel,
      ) => new ExecuteAgentWorkflowHandler(runs, workspace, languageModel),
      inject: [AGENT_RUN_REPOSITORY, AGENT_WORKSPACE, LANGUAGE_MODEL],
    },
  ],
})
export class AgentsModule {}
