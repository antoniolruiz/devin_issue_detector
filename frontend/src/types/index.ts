export interface GitHubLabel {
  name: string;
  color: string;
}

export interface IssueEnrichment {
  summary: string;
  complexity: "Easy" | "Medium";
  impact: string;
  confidence_score: number;
  suggested_next_steps: string[];
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: GitHubLabel[];
  html_url: string;
  created_at: string;
  updated_at: string;
}

export type IssueStatus = "Open" | "In Progress" | "Resolved";

export interface EnrichedIssue {
  issue: GitHubIssue;
  enrichment: IssueEnrichment;
  status: IssueStatus;
  repo: string;
}

export interface ScopingPlan {
  affected_files: string[];
  step_by_step_plan: string[];
  files_to_modify: string[];
  confidence_score: number;
  confidence_rationale: string;
  risks_and_assumptions: string[];
}

export interface ConversationMessage {
  role: "user" | "devin" | "system" | "error";
  content: string;
}

export interface ScopingSession {
  session_id: string;
  devin_session_id: string;
  devin_session_url: string;
  issue_number: number;
  repo: string;
  plan: ScopingPlan | null;
  status: string;
  conversation: ConversationMessage[];
}

export type ExecutionStatus = "Success" | "Partial" | "Failed" | "Pending" | "Running";

export interface ExecutionSession {
  session_id: string;
  devin_session_id: string;
  devin_session_url: string;
  scoping_session_id: string;
  issue_number: number;
  repo: string;
  status: ExecutionStatus;
  pr_url: string;
  pr_number: number;
  diff_summary: string;
  deviations: string[];
  ci_status: string;
  conversation: ConversationMessage[];
}

export interface ConfigStatus {
  github_configured: boolean;
  devin_configured: boolean;
  openai_configured: boolean;
}

export type ScopingAction = "approve" | "challenge" | "modify" | "reject";
export type PRAction = "accept" | "request_changes" | "reject";

export type SortField = "confidence" | "complexity" | "impact" | "number";
export type SortDirection = "asc" | "desc";

export interface FilterState {
  category: string;
  complexity: string;
  confidenceMin: number;
  confidenceMax: number;
  status: string;
  search: string;
}
