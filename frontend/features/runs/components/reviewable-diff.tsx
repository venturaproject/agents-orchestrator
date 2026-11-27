import { ChevronDown } from "lucide-react";
import type { MessageKey } from "@/lib/translations";

type DiffFile = { path: string; patch: string; added: number; removed: number };

function splitDiff(diff: string): DiffFile[] {
  const sections = diff.split(/(?=^diff --git )/m).filter(Boolean);
  if (sections.length === 0) return [{ path: "Patch", patch: diff, added: 0, removed: 0 }];

  return sections.map((patch) => {
    const path = patch.match(/^diff --git a\/(.+?) b\/(.+)$/m)?.[2] || "Patch";
    const lines = patch.split("\n");
    return {
      path,
      patch,
      added: lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
      removed: lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
    };
  });
}

type ReviewableDiffProps = {
  diff: string;
  changedFiles: string[];
  t: (key: MessageKey) => string;
};

export function ReviewableDiff({ diff, changedFiles, t }: ReviewableDiffProps) {
  const files = splitDiff(diff);
  return (
    <details className="result-diff">
      <summary>{t("viewChanges")} ({changedFiles.length || files.length})</summary>
      <div className="diff-file-list">
        {files.map((file, index) => (
          <details className="diff-file" key={`${file.path}-${index}`} open={files.length === 1}>
            <summary>
              <span className="diff-file-name"><ChevronDown size={13} aria-hidden="true" />{file.path}</span>
              <span className="diff-line-counts">
                <span className="diff-added" aria-label={t("addedLines").replace("{count}", String(file.added))}>+{file.added}</span>
                <span className="diff-removed" aria-label={t("removedLines").replace("{count}", String(file.removed))}>−{file.removed}</span>
              </span>
            </summary>
            <pre>{file.patch}</pre>
          </details>
        ))}
      </div>
    </details>
  );
}
