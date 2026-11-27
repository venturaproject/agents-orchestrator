import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewableDiff } from "../features/runs/components/reviewable-diff";
import { messages } from "../lib/translations";

describe("ReviewableDiff", () => {
  it("groups a proposal by file and reports added and removed lines", () => {
    const diff = [
      "diff --git a/app/page.tsx b/app/page.tsx",
      "--- a/app/page.tsx",
      "+++ b/app/page.tsx",
      "@@ -1 +1 @@",
      "-<h1>Old</h1>",
      "+<h1>New</h1>",
      "diff --git a/app/globals.css b/app/globals.css",
      "--- a/app/globals.css",
      "+++ b/app/globals.css",
      "@@ -1 +1,2 @@",
      "+.new { color: red; }",
    ].join("\n");
    render(<ReviewableDiff diff={diff} changedFiles={["app/page.tsx", "app/globals.css"]} t={(key) => messages.en[key]} />);

    expect(screen.getByText("app/page.tsx")).toBeTruthy();
    expect(screen.getByText("app/globals.css")).toBeTruthy();
    expect(screen.getAllByLabelText("1 additions")).toHaveLength(2);
    expect(screen.getByLabelText("1 deletions")).toBeTruthy();
    fireEvent.click(screen.getByText("app/globals.css"));
    expect(screen.getByText(".new { color: red; }", { exact: false })).toBeTruthy();
  });
});
