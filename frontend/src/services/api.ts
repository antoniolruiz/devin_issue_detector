import type {
  EnrichedIssue,
  ScopingSession,
  ExecutionSession,
  ConfigStatus,
  ScopingAction,
  PRAction,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }
  return response.json();
}

// Issues
export async function fetchIssues(repo: string): Promise<EnrichedIssue[]> {
  return apiFetch<EnrichedIssue[]>("/api/issues/fetch", {
    method: "POST",
    body: JSON.stringify({ repo }),
  });
}

export async function enrichIssue(repo: string, issueNumber: number): Promise<EnrichedIssue> {
  return apiFetch<EnrichedIssue>("/api/issues/enrich", {
    method: "POST",
    body: JSON.stringify({ repo, issue_number: issueNumber }),
  });
}

export async function enrichAllIssues(repo: string): Promise<EnrichedIssue[]> {
  return apiFetch<EnrichedIssue[]>("/api/issues/enrich-all", {
    method: "POST",
    body: JSON.stringify({ repo }),
  });
}

export async function getCachedIssues(repo: string): Promise<EnrichedIssue[]> {
  return apiFetch<EnrichedIssue[]>(`/api/issues/${repo}`);
}

// Scoping
export async function startScoping(repo: string, issueNumber: number): Promise<ScopingSession> {
  return apiFetch<ScopingSession>("/api/scope/start", {
    method: "POST",
    body: JSON.stringify({ repo, issue_number: issueNumber }),
  });
}

export async function getScopingSession(sessionId: string): Promise<ScopingSession> {
  return apiFetch<ScopingSession>(`/api/scope/${sessionId}`);
}

export async function sendScopingFeedback(
  sessionId: string,
  action: ScopingAction,
  feedback: string = ""
): Promise<ScopingSession> {
  return apiFetch<ScopingSession>(`/api/scope/${sessionId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ action, feedback }),
  });
}

// Execution
export async function startExecution(scopingSessionId: string): Promise<ExecutionSession> {
  return apiFetch<ExecutionSession>("/api/execute/start", {
    method: "POST",
    body: JSON.stringify({ scoping_session_id: scopingSessionId }),
  });
}

export async function getExecutionSession(sessionId: string): Promise<ExecutionSession> {
  return apiFetch<ExecutionSession>(`/api/execute/${sessionId}`);
}

export async function sendPRAction(
  sessionId: string,
  action: PRAction,
  feedback: string = ""
): Promise<ExecutionSession> {
  return apiFetch<ExecutionSession>(`/api/execute/${sessionId}/pr-action`, {
    method: "POST",
    body: JSON.stringify({ action, feedback }),
  });
}

// Config
export async function getConfigStatus(): Promise<ConfigStatus> {
  return apiFetch<ConfigStatus>("/api/config/status");
}

export async function updateConfig(config: {
  github_token?: string;
  devin_api_token?: string;
  devin_org_id?: string;
  openai_api_key?: string;
}): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/api/config/update", {
    method: "POST",
    body: JSON.stringify(config),
  });
}
