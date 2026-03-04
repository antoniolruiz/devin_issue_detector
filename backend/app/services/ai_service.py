import json
from typing import Optional

from openai import AsyncOpenAI

from app.models.schemas import IssueEnrichment, Complexity, GitHubIssue, ScopingPlan


class AIService:
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)

    async def enrich_issue(self, issue: GitHubIssue, repo: str) -> IssueEnrichment:
        label_names = [l.name for l in issue.labels]
        prompt = f"""Analyze this GitHub issue from the repository '{repo}' and provide enrichment metadata.

Issue #{issue.number}: {issue.title}
Labels: {', '.join(label_names) if label_names else 'None'}
Body:
{issue.body[:2000]}

Respond in JSON format with these fields:
- "summary": A plain-language summary of what the issue is and why it matters (2-3 sentences)
- "complexity": "Easy" or "Medium" (infer from labels if available, otherwise from the issue content)
- "impact": One sentence about how this affects data correctness, reliability, or maintainability
- "confidence_score": 0-100 integer estimating how likely this issue could be autonomously resolved by an AI coding agent
- "suggested_next_steps": Array of 1-3 bullet points with specific files, functions, or line numbers where possible

Return ONLY valid JSON, no markdown fences."""

        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a senior software engineer analyzing GitHub issues for an ETL data pipeline project. Be specific about file locations and code changes needed."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=500,
        )

        content = response.choices[0].message.content or "{}"
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return IssueEnrichment(
                summary=f"Issue #{issue.number}: {issue.title}",
                complexity=self._infer_complexity(label_names),
                impact="Could not generate AI analysis.",
                confidence_score=50,
                suggested_next_steps=["Review the issue manually"],
            )

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

    def _infer_complexity(self, labels: list[str]) -> Complexity:
        for label in labels:
            if label.lower() == "easy":
                return Complexity.EASY
            if label.lower() == "medium":
                return Complexity.MEDIUM
        return Complexity.EASY

    async def parse_scoping_response(self, raw_text: str) -> Optional[ScopingPlan]:
        prompt = f"""Extract the scoping plan from this Devin session response. Parse it into structured data.

Response:
{raw_text[:3000]}

Return JSON with:
- "affected_files": list of file paths mentioned
- "step_by_step_plan": list of steps in the plan
- "files_to_modify": list of files to be modified or created
- "confidence_score": 0-100 confidence that changes will work
- "confidence_rationale": one sentence explaining the confidence level
- "risks_and_assumptions": list of any identified risks

Return ONLY valid JSON."""

        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You extract structured data from Devin AI session outputs."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=800,
        )

        content = response.choices[0].message.content or "{}"
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        try:
            data = json.loads(content)
            return ScopingPlan(**data)
        except (json.JSONDecodeError, Exception):
            return None
