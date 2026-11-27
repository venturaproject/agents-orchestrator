const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ExecuteAgentWorkflowHandler,
} = require("../dist/application/agents/commands/execute-agent-workflow.handler");
const { ExecuteAgentWorkflowCommand } = require("../dist/application/agents/commands/execute-agent-workflow.command");

const runId = "f6285ec7-f45e-4cb4-a8ad-7283717e41b2";
const ownerId = "0bba52c0-e0a6-490c-8f86-54e8b1d1c902";
const persistedRun = {
  id: runId,
  prompt: "Add a welcome heading",
  status: "En curso",
  tasks: [],
  result: {},
};

function makeWorkspace() {
  return {
    async create() { return { root: "/workspace", directory: "/workspace/run" }; },
    async listFiles() { return ["app/page.tsx"]; },
    async readContext() { return "Existing page"; },
    validateTargets(files) { return files.slice(0, 3); },
    normalizePatch(patch) { return patch; },
    validatePatch() { return ["app/page.tsx"]; },
    async applyPatch() {},
    async getDiff() { return "diff --git a/app/page.tsx b/app/page.tsx"; },
    async typecheck() { return { passed: true, output: "tsc --noEmit: sin errores." }; },
    async remove() {},
  };
}

test("agent workflow scopes run lookup and every persisted update to its owner", async () => {
  const saved = [];
  const repository = {
    async findByIdAndOwner(id, userId) {
      assert.equal(id, runId);
      assert.equal(userId, ownerId);
      return persistedRun;
    },
    async save(run) { saved.push(run); },
  };
  const modelResponses = [
    JSON.stringify({ summary: "Add a heading", tasks: ["Add heading"], files: ["app/page.tsx"] }),
    "diff --git a/app/page.tsx b/app/page.tsx",
    JSON.stringify({ passed: true, feedback: [], summary: "The change meets the request." }),
  ];
  const model = {
    async complete() {
      const next = modelResponses.shift();
      assert.ok(next, "unexpected extra model call");
      return next;
    },
  };
  const handler = new ExecuteAgentWorkflowHandler(repository, makeWorkspace(), model);

  const result = await handler.execute(new ExecuteAgentWorkflowCommand(runId, ownerId, "en"));
  assert.equal(result.status, "Completed");
  assert.equal(result.passed, true);
  assert.equal(result.iterations, 1);
  assert.ok(saved.length >= 4);
  assert.ok(saved.every((run) => run.userId === ownerId && run.id === runId));
  assert.equal(modelResponses.length, 0);
});

test("agent workflow refuses to access a run that is not owned by the authenticated user", async () => {
  let modelCalled = false;
  let workspaceCreated = false;
  const handler = new ExecuteAgentWorkflowHandler(
    {
      async findByIdAndOwner() { return null; },
      async save() { assert.fail("must not persist an unowned run"); },
    },
    {
      ...makeWorkspace(),
      async create() { workspaceCreated = true; throw new Error("unexpected"); },
    },
    { async complete() { modelCalled = true; return ""; } },
  );

  await assert.rejects(
    handler.execute(new ExecuteAgentWorkflowCommand(runId, ownerId, "en")),
    { name: "AgentRunNotFoundError" },
  );
  assert.equal(modelCalled, false);
  assert.equal(workspaceCreated, false);
});
