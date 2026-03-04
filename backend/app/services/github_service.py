import httpx
from typing import Optional

from app.models.schemas import GitHubIssue, GitHubLabel


class GitHubService:
    BASE_URL = "https://api.github.com"

    def __init__(self, token: Optional[str] = None):
        self.token = token
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
        }
        if token:
            self.headers["Authorization"] = f"token {token}"

    async def fetch_issues(self, repo: str, state: str = "all") -> list[GitHubIssue]:
        url = f"{self.BASE_URL}/repos/{repo}/issues"
        params = {"state": state, "per_page": 100}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            raw_issues = response.json()

        issues = []
        for raw in raw_issues:
            if "pull_request" in raw:
                continue
            labels = [
                GitHubLabel(name=l["name"], color=l.get("color", ""))
                for l in raw.get("labels", [])
            ]
            issue = GitHubIssue(
                number=raw["number"],
                title=raw["title"],
                body=raw.get("body", "") or "",
                state=raw["state"],
                labels=labels,
                html_url=raw.get("html_url", ""),
                created_at=raw.get("created_at", ""),
                updated_at=raw.get("updated_at", ""),
            )
            issues.append(issue)
        return issues

    async def get_issue(self, repo: str, issue_number: int) -> GitHubIssue:
        url = f"{self.BASE_URL}/repos/{repo}/issues/{issue_number}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            raw = response.json()

        labels = [
            GitHubLabel(name=l["name"], color=l.get("color", ""))
            for l in raw.get("labels", [])
        ]
        return GitHubIssue(
            number=raw["number"],
            title=raw["title"],
            body=raw.get("body", "") or "",
            state=raw["state"],
            labels=labels,
            html_url=raw.get("html_url", ""),
            created_at=raw.get("created_at", ""),
            updated_at=raw.get("updated_at", ""),
        )

    async def get_pr_diff(self, repo: str, pr_number: int) -> str:
        url = f"{self.BASE_URL}/repos/{repo}/pulls/{pr_number}"
        headers = {**self.headers, "Accept": "application/vnd.github.v3.diff"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.text

    async def merge_pr(self, repo: str, pr_number: int) -> dict:
        url = f"{self.BASE_URL}/repos/{repo}/pulls/{pr_number}/merge"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(url, headers=self.headers, json={"merge_method": "squash"})
            response.raise_for_status()
            return response.json()

    async def close_pr(self, repo: str, pr_number: int) -> dict:
        url = f"{self.BASE_URL}/repos/{repo}/pulls/{pr_number}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.patch(url, headers=self.headers, json={"state": "closed"})
            response.raise_for_status()
            return response.json()

    async def comment_on_pr(self, repo: str, pr_number: int, body: str) -> dict:
        url = f"{self.BASE_URL}/repos/{repo}/issues/{pr_number}/comments"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=self.headers, json={"body": body})
            response.raise_for_status()
            return response.json()
