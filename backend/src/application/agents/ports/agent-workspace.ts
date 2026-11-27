export const AGENT_WORKSPACE = Symbol("AGENT_WORKSPACE");

export type WorkspaceTypecheckResult = { passed: boolean; output: string };

export interface AgentWorkspace {
  create(runId: string): Promise<{ root: string; directory: string }>;
  listFiles(directory: string): Promise<string[]>;
  readContext(directory: string, files: string[]): Promise<string>;
  validateTargets(files: unknown): string[];
  normalizePatch(patch: string): string;
  validatePatch(patch: string, allowedFiles: string[]): string[];
  applyPatch(directory: string, patch: string): Promise<void>;
  getDiff(directory: string): Promise<string>;
  typecheck(directory: string): Promise<WorkspaceTypecheckResult>;
  remove(directory: string): Promise<void>;
}
