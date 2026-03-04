"""In-memory store for enriched issue metadata, scoping sessions, and execution sessions."""

from typing import Optional
import uuid

from app.models.schemas import (
    EnrichedIssue,
    ScopingSession,
    ExecutionSession,
)


class Store:
    def __init__(self):
        self.issues: dict[str, dict[int, EnrichedIssue]] = {}
        self.scoping_sessions: dict[str, ScopingSession] = {}
        self.execution_sessions: dict[str, ExecutionSession] = {}

    def get_issues(self, repo: str) -> list[EnrichedIssue]:
        return list(self.issues.get(repo, {}).values())

    def get_issue(self, repo: str, issue_number: int) -> Optional[EnrichedIssue]:
        return self.issues.get(repo, {}).get(issue_number)

    def set_issue(self, repo: str, issue: EnrichedIssue):
        if repo not in self.issues:
            self.issues[repo] = {}
        self.issues[repo][issue.issue.number] = issue

    def clear_repo(self, repo: str):
        self.issues.pop(repo, None)

    def create_scoping_session(self, repo: str, issue_number: int) -> ScopingSession:
        session_id = str(uuid.uuid4())
        session = ScopingSession(
            session_id=session_id,
            issue_number=issue_number,
            repo=repo,
        )
        self.scoping_sessions[session_id] = session
        return session

    def get_scoping_session(self, session_id: str) -> Optional[ScopingSession]:
        return self.scoping_sessions.get(session_id)

    def create_execution_session(
        self, scoping_session_id: str, repo: str, issue_number: int
    ) -> ExecutionSession:
        session_id = str(uuid.uuid4())
        session = ExecutionSession(
            session_id=session_id,
            scoping_session_id=scoping_session_id,
            issue_number=issue_number,
            repo=repo,
        )
        self.execution_sessions[session_id] = session
        return session

    def get_execution_session(self, session_id: str) -> Optional[ExecutionSession]:
        return self.execution_sessions.get(session_id)

    def get_execution_sessions_for_issue(
        self, repo: str, issue_number: int
    ) -> list[ExecutionSession]:
        return [
            s
            for s in self.execution_sessions.values()
            if s.repo == repo and s.issue_number == issue_number
        ]


store = Store()
