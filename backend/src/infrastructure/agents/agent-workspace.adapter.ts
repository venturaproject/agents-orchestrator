import type { AgentWorkspace } from "../../application/agents/ports/agent-workspace";
import {
  applyPatch,
  createWorkspace,
  getWorkspaceDiff,
  listWorkspaceFiles,
  normalizePatch,
  readWorkspaceContext,
  removeWorkspace,
  typecheckWorkspace,
  validatePatch,
  validateTargetFiles,
} from "./agent-workspace";

export class AgentWorkspaceAdapter implements AgentWorkspace {
  create = createWorkspace;
  listFiles = listWorkspaceFiles;
  readContext = readWorkspaceContext;
  validateTargets = validateTargetFiles;
  normalizePatch = normalizePatch;
  validatePatch = validatePatch;
  applyPatch = applyPatch;
  getDiff = getWorkspaceDiff;
  typecheck = typecheckWorkspace;
  remove = removeWorkspace;
}
