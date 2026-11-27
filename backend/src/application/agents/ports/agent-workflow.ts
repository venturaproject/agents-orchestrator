export type AgentWorkflowResult = {
  status: string;
  summary?: string;
  plan?: string[];
  targetFiles?: string[];
  diff?: string;
  testOutput?: string;
  review?: string;
  iterations?: number;
  changedFiles?: string[];
  passed?: boolean;
};
