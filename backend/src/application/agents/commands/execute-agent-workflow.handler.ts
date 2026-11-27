import type { AgentRunRepository } from "../../agent-runs/ports/agent-run-repository";
import type { AgentWorkflowResult } from "../ports/agent-workflow";
import type { AgentWorkspace } from "../ports/agent-workspace";
import type { LanguageModel } from "../ports/language-model";
import { AgentRun } from "../../../domain/agent-runs/entities/agent-run";
import type { ExecuteAgentWorkflowCommand } from "./execute-agent-workflow.command";
import { workflowMessages } from "../workflow-messages";
import { AgentRunNotFoundError } from "../errors/agent-run-not-found.error";

type Task = {
  id: string;
  title: string;
  agent: "Orchestrator" | "Develop" | "Testing";
  status: "done" | "active" | "queued" | "failed";
  detail: string;
  time: string;
};
type Plan = { summary: string; tasks: string[]; files: string[] };
type Review = { passed: boolean; feedback: string[]; summary: string };

const maxIterations = 3;
const timestamp = () => new Date().toLocaleTimeString("es-ES", { hour12: false });

function parseObject<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Agent response did not contain valid JSON.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export class ExecuteAgentWorkflowHandler {
  constructor(
    private readonly runs: AgentRunRepository,
    private readonly workspaceAdapter: AgentWorkspace,
    private readonly languageModel: LanguageModel,
  ) {}

  private async saveProgress(
    runId: string,
    userId: string,
    prompt: string,
    status: string,
    tasks: Task[],
    result: Record<string, unknown>,
  ) {
    await this.runs.save(new AgentRun({ id: runId, userId, prompt, status, tasks, result }));
  }

  async execute(command: ExecuteAgentWorkflowCommand): Promise<AgentWorkflowResult> {
    const { runId, userId, locale } = command;
    if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new Error("Ejecución no válida.");
    const run = await this.runs.findByIdAndOwner(runId, userId);
    if (!run) throw new AgentRunNotFoundError();

    const text = workflowMessages(locale);

    let tasks: Task[] = [{
      id: "orchestrator",
      title: text.planning,
      agent: "Orchestrator",
      status: "active",
      detail: text.planningDetail,
      time: timestamp(),
    }];
    let result: Record<string, unknown> = {
      summary: "",
      plan: [],
      diff: "",
      testOutput: "",
      iterations: 0,
      passed: false,
    };
    let workspace = "";

    try {
      await this.saveProgress(runId, userId, run.prompt, text.inProgress, tasks, result);
      const created = await this.workspaceAdapter.create(runId);
      workspace = created.directory;
      const fileList = await this.workspaceAdapter.listFiles(workspace);
      const planText = await this.languageModel.complete(
        text.planningPrompt,
        `${text.userRequest}\n${run.prompt}\n\n${text.availableFiles}\n${fileList.join("\n")}`,
        1000,
      );
      const plan = parseObject<Plan>(planText);
      if (!plan.summary || !Array.isArray(plan.tasks) || plan.tasks.length < 1) {
        throw new Error(text.malformedPlan);
      }
      plan.tasks = plan.tasks.slice(0, 4).map((task) => String(task).slice(0, 180));

      let targetFiles: string[];
      try {
        targetFiles = this.workspaceAdapter.validateTargets(plan.files);
      } catch {
        const retryText = await this.languageModel.complete(
          text.repairPrompt,
          `${text.requirements} ${run.prompt}\n${text.previousPlan} ${plan.tasks.join("; ")}\n${text.repairPlan}`,
          800,
        );
        const retryPlan = parseObject<Plan>(retryText);
        if (retryPlan.summary) plan.summary = retryPlan.summary.slice(0, 400);
        if (Array.isArray(retryPlan.tasks) && retryPlan.tasks.length) {
          plan.tasks = retryPlan.tasks.slice(0, 4).map((task) => String(task).slice(0, 180));
        }
        targetFiles = this.workspaceAdapter.validateTargets(retryPlan.files);
      }

      tasks = [
        { id: "orchestrator", title: text.planning, agent: "Orchestrator", status: "done", detail: plan.summary.slice(0, 240), time: timestamp() },
        ...plan.tasks.map((title, index): Task => ({
          id: `develop-${index + 1}`, title, agent: "Develop", status: "queued", detail: text.waiting, time: "—",
        })),
        { id: "testing", title: text.review, agent: "Testing", status: "queued", detail: text.waitingForDevelop, time: "—" },
      ];
      result = { summary: plan.summary, plan: plan.tasks, targetFiles, diff: "", testOutput: "", iterations: 0, passed: false };
      await this.saveProgress(runId, userId, run.prompt, text.inProgress, tasks, result);

      let feedback = "";
      let passed = false;
      let finalDiff = "";
      let finalTestOutput = "";
      let finalReview = "";
      let changedFiles: string[] = [];

      for (let iteration = 1; iteration <= maxIterations; iteration++) {
        tasks = tasks.map((task) => task.agent === "Develop"
          ? { ...task, status: "active", detail: text.iteration(iteration, maxIterations), time: timestamp() }
          : task.agent === "Testing"
            ? { ...task, status: "queued", detail: text.waitingForPatch, time: "—" }
            : task);
        await this.saveProgress(runId, userId, run.prompt, text.inProgress, tasks, { ...result, iterations: iteration });

        const context = await this.workspaceAdapter.readContext(workspace, targetFiles);
        let patchError = "";
        for (let patchAttempt = 1; patchAttempt <= 2; patchAttempt++) {
          try {
            const developText = await this.languageModel.complete(
              text.developPrompt,
              `${text.originalRequest}\n${run.prompt}\n\n${text.plan}\n${plan.tasks.map((task, index) => `${index + 1}. ${task}`).join("\n")}\n\n${text.allowedFiles} ${targetFiles.join(", ")}\n\n${text.targetContext}\n${context}\n\n${patchError ? `${text.previousPatchRejected}: ${patchError}.` : feedback ? `${text.previousReviewFeedback}\n${feedback}` : text.implementPlan}`,
              3000,
            );
            const patch = this.workspaceAdapter.normalizePatch(developText);
            changedFiles = this.workspaceAdapter.validatePatch(patch, targetFiles);
            await this.workspaceAdapter.applyPatch(workspace, patch);
            patchError = "";
            break;
          } catch (error) {
            patchError = error instanceof Error ? error.message : text.invalidPatch;
            if (patchAttempt === 2) throw error;
          }
        }
        finalDiff = await this.workspaceAdapter.getDiff(workspace);
        tasks = tasks.map((task) => task.agent === "Develop"
          ? { ...task, status: "done", detail: text.changedFiles(changedFiles.join(", ")).slice(0, 240), time: timestamp() }
          : task.agent === "Testing"
            ? { ...task, status: "active", detail: `${text.checking} ${iteration}/${maxIterations}`, time: timestamp() }
            : task);
        await this.saveProgress(runId, userId, run.prompt, text.inProgress, tasks, { ...result, diff: finalDiff, iterations: iteration, changedFiles });

        const typecheck = await this.workspaceAdapter.typecheck(workspace);
        const reviewText = await this.languageModel.complete(
          text.reviewPrompt,
          `${text.reviewRequest}\n${run.prompt}\n\n${text.plan}\n${plan.tasks.join("\n")}\n\n${text.developDiff}\n${finalDiff.slice(0, 14_000)}\n\n${text.typecheckResult}\n${typecheck.passed ? text.pass : text.fail}\n${typecheck.output.slice(0, 3500)}`,
          1000,
        );
        const review = parseObject<Review>(reviewText);
        finalTestOutput = `${text.typecheckLabel}: ${typecheck.passed ? text.pass : text.fail}\n${typecheck.output}\n\n${text.reviewLabel}: ${text.completedReview(review.passed, review.summary)}\n${(review.feedback || []).join("\n")}`;
        finalReview = review.summary || "";
        passed = typecheck.passed && review.passed;
        result = { summary: plan.summary, plan: plan.tasks, targetFiles, diff: finalDiff, testOutput: finalTestOutput, review: finalReview, iterations: iteration, changedFiles, passed };
        if (passed) break;
        feedback = [...(!typecheck.passed ? [text.typecheckFeedback(typecheck.output)] : []), ...(review.feedback || [review.summary])].join("\n");
        if (iteration < maxIterations) {
          tasks = tasks.map((task) => task.agent === "Develop"
            ? { ...task, status: "queued", detail: `Testing solicita correcciones para la ronda ${iteration + 1}…`, time: "—" }
            : task.agent === "Testing"
              ? { ...task, status: "failed", detail: `Ronda ${iteration}: ${review.summary}`.slice(0, 240), time: timestamp() }
              : task);
          await this.saveProgress(runId, userId, run.prompt, text.inProgress, tasks, result);
        }
      }

      tasks = tasks.map((task) => task.agent === "Testing"
        ? { ...task, status: passed ? "done" : "failed", detail: text.statusDetail(passed, finalReview).slice(0, 240), time: timestamp() }
        : task.agent === "Develop" && !passed ? { ...task, status: "done" } : task);
      const status = passed ? text.completed : text.failedStatus;
      await this.saveProgress(runId, userId, run.prompt, status, tasks, result);
      return { status, ...result } as AgentWorkflowResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : text.unknownError;
      tasks = tasks.map((task) => task.status === "active"
        ? { ...task, status: "failed", detail: message.slice(0, 240), time: timestamp() }
        : task);
      await this.saveProgress(runId, userId, run.prompt, text.failedStatus, tasks, { ...result, error: text.resultError(message), passed: false }).catch(() => {});
      throw error;
    } finally {
      if (workspace) await this.workspaceAdapter.remove(workspace).catch(() => {});
    }
  }
}
