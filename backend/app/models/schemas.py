from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Complexity(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"


class IssueStatus(str, Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"


class ScopingAction(str, Enum):
    APPROVE = "approve"
    CHALLENGE = "challenge"
    MODIFY = "modify"
    REJECT = "reject"


class PRAction(str, Enum):
    ACCEPT = "accept"
    REQUEST_CHANGES = "request_changes"
    REJECT = "reject"


class ExecutionStatus(str, Enum):
    SUCCESS = "Success"
    PARTIAL = "Partial"
    FAILED = "Failed"
    PENDING = "Pending"
    RUNNING = "Running"


class GitHubLabel(BaseModel):
    name: str
    color: str = ""


class IssueEnrichment(BaseModel):
    summary: str = ""
    complexity: Complexity = Complexity.EASY
    impact: str = ""
    confidence_score: int = Field(default=50, ge=0, le=100)
    suggested_next_steps: list[str] = Field(default_factory=list)


class GitHubIssue(BaseModel):
    number: int
    title: str
    body: str = ""
    state: str = "open"
    labels: list[GitHubLabel] = Field(default_factory=list)
    html_url: str = ""
    created_at: str = ""
    updated_at: str = ""


class EnrichedIssue(BaseModel):
    issue: GitHubIssue
    enrichment: IssueEnrichment = Field(default_factory=IssueEnrichment)
    status: IssueStatus = IssueStatus.OPEN
    repo: str = ""


class RepoRequest(BaseModel):
    repo: str = "antoniolruiz/devin_demo"


class EnrichRequest(BaseModel):
    repo: str
    issue_number: int


class ScopingPlan(BaseModel):
    affected_files: list[str] = Field(default_factory=list)
    step_by_step_plan: list[str] = Field(default_factory=list)
    files_to_modify: list[str] = Field(default_factory=list)
    confidence_score: int = Field(default=50, ge=0, le=100)
    confidence_rationale: str = ""
    risks_and_assumptions: list[str] = Field(default_factory=list)


class ScopingSession(BaseModel):
    session_id: str = ""
    devin_session_id: str = ""
    devin_session_url: str = ""
    issue_number: int
    repo: str
    plan: Optional[ScopingPlan] = None
    status: str = "pending"
    conversation: list[dict] = Field(default_factory=list)


class ScopeRequest(BaseModel):
    repo: str
    issue_number: int


class ScopeFeedbackRequest(BaseModel):
    action: ScopingAction
    feedback: str = ""


class ExecutionSession(BaseModel):
    session_id: str = ""
    devin_session_id: str = ""
    devin_session_url: str = ""
    scoping_session_id: str = ""
    issue_number: int
    repo: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    pr_url: str = ""
    pr_number: int = 0
    diff_summary: str = ""
    deviations: list[str] = Field(default_factory=list)
    ci_status: str = ""
    conversation: list[dict] = Field(default_factory=list)


class ExecuteRequest(BaseModel):
    scoping_session_id: str


class PRActionRequest(BaseModel):
    action: PRAction
    feedback: str = ""


class ConfigRequest(BaseModel):
    github_token: str = ""
    devin_api_token: str = ""
    devin_org_id: str = ""
