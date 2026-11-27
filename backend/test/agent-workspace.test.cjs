const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  createWorkspace,
  normalizePatch,
  validatePatch,
  validateTargetFiles,
} = require("../dist/infrastructure/agents/agent-workspace");

test("workspace copies UI context into the configured disposable directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "crew-workspace-test-"));
  const previousRoot = process.env.AGENT_WORKSPACE_ROOT;
  process.env.AGENT_WORKSPACE_ROOT = root;
  try {
    const { directory } = await createWorkspace(randomUUID());
    const component = await readFile(path.join(directory, "components/account-menu.tsx"), "utf8");
    assert.match(component, /DropdownMenu\.Root/);
  } finally {
    if (previousRoot === undefined) delete process.env.AGENT_WORKSPACE_ROOT;
    else process.env.AGENT_WORKSPACE_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

test("target allowlist only permits supported frontend UI files", () => {
  assert.deepEqual(validateTargetFiles(["app/page.tsx", "app/settings/page.tsx"]), [
    "app/page.tsx",
    "app/settings/page.tsx",
  ]);
  assert.deepEqual(validateTargetFiles(["app/globals.css"]), ["app/globals.css"]);
  for (const target of ["app/api/auth/login/route.ts", "app/layout.tsx", "../package.json", "app/page.ts", "app/../../../secrets.css"]) {
    assert.throws(() => validateTargetFiles([target]));
  }
});

test("patch validation requires the exact approved path and rejects duplicate/unsafe paths", () => {
  const patch = [
    "diff --git a/app/page.tsx b/app/page.tsx",
    "index 1a2b3c4..5d6e7f8 100644",
    "--- a/app/page.tsx",
    "+++ b/app/page.tsx",
    "@@ -1 +1 @@",
    "-export default function Page() { return <main />; }",
    "+export default function Page() { return <main><h1>Crew</h1></main>; }",
    "",
  ].join("\n");
  assert.deepEqual(validatePatch(patch, ["app/page.tsx"]), ["app/page.tsx"]);
  assert.throws(() => validatePatch(patch, ["app/globals.css"]), /Ruta fuera del sandbox/);
  assert.throws(() => validatePatch("diff --git a/app/page.tsx b/app/page.tsx\n".repeat(2), ["app/page.tsx"]), /repite archivos/);
  assert.throws(() => validatePatch("diff --git a/app/../../secret.tsx b/app/../../secret.tsx\n", ["app/../../secret.tsx"]));
});

test("normalizes a unified diff without git headers", () => {
  const diff = "--- a/app/page.tsx\n+++ b/app/page.tsx\n@@ -1 +1 @@\n-old\n+new\n";
  assert.match(normalizePatch(diff), /diff --git a\/app\/page\.tsx b\/app\/page\.tsx/);
});
