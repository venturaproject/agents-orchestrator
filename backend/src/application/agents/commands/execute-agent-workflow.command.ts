export class ExecuteAgentWorkflowCommand {
  constructor(
    readonly runId: string,
    readonly userId: string,
    readonly locale: "en" | "es",
  ) {}
}
