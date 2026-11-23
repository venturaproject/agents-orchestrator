import { describe, expect, it } from "vitest";
import { normalizePatch, validatePatch, validateTargetFiles } from "../lib/agent-workspace";

describe("agent workspace path allowlist", () => {
  it("accepts supported UI files and nested app routes", () => {
    expect(validateTargetFiles(["app/page.tsx", "app/settings/page.tsx"])).toEqual([
      "app/page.tsx",
      "app/settings/page.tsx",
    ]);
    expect(validateTargetFiles(["app/globals.css"])).toEqual(["app/globals.css"]);
  });

  it.each([
    ["app/api/auth/login/route.ts"],
    ["app/layout.tsx"],
    ["../package.json"],
    ["app/page.ts"],
    ["app/../../../secrets.css"],
  ])("rejects forbidden target %s", (target) => {
    expect(() => validateTargetFiles([target])).toThrow();
  });

  it("accepts a diff only for the exact planner-approved path", () => {
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

    expect(validatePatch(patch, ["app/page.tsx"])).toEqual(["app/page.tsx"]);
    expect(() => validatePatch(patch, ["app/globals.css"])).toThrow(/Ruta fuera del sandbox/);
  });

  it("rejects duplicated file sections and unsafe paths", () => {
    const duplicate = "diff --git a/app/page.tsx b/app/page.tsx\n".repeat(2);
    const traversal = "diff --git a/app/../../secret.tsx b/app/../../secret.tsx\n";
    expect(() => validatePatch(duplicate, ["app/page.tsx"])).toThrow(/repite archivos/);
    expect(() => validatePatch(traversal, ["app/../../secret.tsx"])).toThrow();
  });

  it("normalizes a basic unified diff without a git header", () => {
    const diff = "--- a/app/page.tsx\n+++ b/app/page.tsx\n@@ -1 +1 @@\n-old\n+new\n";
    expect(normalizePatch(diff)).toContain("diff --git a/app/page.tsx b/app/page.tsx");
  });
});
