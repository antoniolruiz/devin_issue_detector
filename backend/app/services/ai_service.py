import json
import asyncio
from typing import Optional

from app.models.schemas import IssueEnrichment, Complexity, GitHubIssue, ScopingPlan
from app.services.devin_service import DevinService


class AIService:
    """AI enrichment service powered by Devin API sessions."""

    def __init__(self, devin_service: DevinService):
        self.devin = devin_service

    async def enrich_issue(self, issue: GitHubIssue, repo: str) -> IssueEnrichment:
        label_names = [l.name for l in issue.labels]
        prompt = f"""Analyze this GitHub issue from the repository '{repo}' and provide enrichment metadata.

Issue #{issue.number}: {issue.title}
Labels: {', '.join(label_names) if label_names else 'None'}
Body:
{issue.body[:2000]}

Respond with ONLY a JSON object (no markdown fences, no extra text) with these fields:
- "summary": A plain-language summary of what the issue is and why it matters (2-3 sentences)
- "complexity": "Easy" or "Medium" (infer from labels if available, otherwise from the issue content)
- "impact": One sentence about how this affects data correctness, reliability, or maintainability
- "confidence_score": 0-100 integer estimating how likely this issue could be autonomously resolved by an AI coding agent
- "suggested_next_steps": Array of 1-3 bullet points with specific files, functions, or line numbers where possible

Return ONLY valid JSON."""

        try:
            devin_response = await self.devin.create_session(
                prompt=prompt,
                repos=[repo],
                title=f"Enrich: {repo}#{issue.number} - {issue.title[:50]}",
                tags=["enrichment", f"issue-{issue.number}"],
            )
            session_id = devin_response.get("session_id", "")
            if not session_id:
                return self._fallback_enrichment(issue, label_names)

            content = await self._poll_session(session_id, timeout=120)
            if not content:
                return self._fallback_enrichment(issue, label_names)

            return self._parse_enrichment(content, issue, label_names)

        except Exception:
            return self._fallback_enrichment(issue, label_names)

    async def parse_scoping_response(self, raw_text: str) -> Optional[ScopingPlan]:
        prompt = f"""Extract the scoping plan from this Devin session response. Parse it into structured data.

Response:
{raw_text[:3000]}

Return ONLY a JSON object (no markdown fences, no extra text) with:
- "affected_files": list of file paths mentioned
- "step_by_step_plan": list of steps in the plan
- "files_to_modify": list of files to be modified or created
- "confidence_score": 0-100 confidence that changes will work
- "confidence_rationale": one sentence explaining the confidence level
- "risks_and_assumptions": list of any identified risks

Return ONLY valid JSON."""

        try:
            devin_response = await self.devin.create_session(
                prompt=prompt,
                title="Parse scoping response",
                tags=["parsing"],
            )
            session_id = devin_response.get("session_id", "")
            if not session_id:
                return None

            content = await self._poll_session(session_id, timeout=120)
            if not content:
                return None

            return self._parse_scoping_plan(content)

        except Exception:
            return None

    async def _poll_session(self, session_id: str, timeout: int = 120) -> Optional[str]:
        """Poll a Devin session until it completes and return the output."""
        elapsed = 0
        poll_interval = 5
        while elapsed < timeout:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
            try:
                status = await self.devin.get_session(session_id)
                state = status.get("status", "")
                if state in ("exit", "suspended", "stopped"):
                    structured_output = status.get("structured_output", "")
                    if structured_output:
                        return structured_output
                    messages = status.get("messages", [])
                    if messages:
                        last = messages[-1]
                        return last.get("content", "") or last.get("message", "")
                    return str(status)
                elif state == "error":
                    return None
            except Exception:
                continue
        return None

    def _fallback_enrichment(self, issue: GitHubIssue, labels: list[str]) -> IssueEnrichment:
        """Return a basic enrichment when Devin session fails."""
        return IssueEnrichment(
            summary=f"Issue #{issue.number}: {issue.title}",
            complexity=self._infer_complexity(labels),
            impact="Could not generate AI analysis.",
            confidence_score=50,
            suggested_next_steps=["Review the issue manually"],
        )

    def _parse_enrichment(
        self, content: str, issue: GitHubIssue, labels: list[str]
    ) -> IssueEnrichment:
        """Parse JSON enrichment from Devin session output."""
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        json_str = self._extract_json(content)

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            return self._fallback_enrichment(issue, labels)

        complexity_raw = data.get("complexity", "Easy")
        if complexity_raw.lower() == "medium":
            complexity = Complexity.MEDIUM
        else:
            complexity = Complexity.EASY

        return IssueEnrichment(
            summary=data.get("summary", f"Issue #{issue.number}: {issue.title}"),
            complexity=complexity,
            impact=data.get("impact", ""),
            confidence_score=min(100, max(0, int(data.get("confidence_score", 50)))),
            suggested_next_steps=data.get("suggested_next_steps", []),
        )

    def _parse_scoping_plan(self, content: str) -> Optional[ScopingPlan]:
        """Parse JSON scoping plan from Devin session output."""
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        json_str = self._extract_json(content)

        try:
            data = json.loads(json_str)
            return ScopingPlan(**data)
        except (json.JSONDecodeError, Exception):
            return None

    def _extract_json(self, text: str) -> str:
        """Try to extract a JSON object from text that may contain other content."""
        text = text.strip()
        start = text.find("{")
        if start != -1:
            depth = 0
            for i in range(start, len(text)):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        return text[start : i + 1]
        return text

    def _infer_complexity(self, labels: list[str]) -> Complexity:
        for label in labels:
            if label.lower() == "easy":
                return Complexity.EASY
            if label.lower() == "medium":
                return Complexity.MEDIUM
        return Complexity.EASY
