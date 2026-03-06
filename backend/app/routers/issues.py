from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    RepoRequest,
    EnrichRequest,
    EnrichedIssue,
    IssueEnrichment,
    IssueStatus,
)
from app.store import store
from app.dependencies import get_github_service, get_ai_service

router = APIRouter(prefix="/api/issues", tags=["issues"])


@router.post("/fetch", response_model=list[EnrichedIssue])
async def fetch_issues(request: RepoRequest):
    """Fetch issues from GitHub for a given repo and cache them."""
    github = get_github_service()
    if not github:
        raise HTTPException(status_code=500, detail="GitHub service not configured. Set GITHUB_TOKEN.")

    repo = request.repo.strip()
    if not repo or "/" not in repo:
        raise HTTPException(status_code=400, detail="Invalid repo format. Use owner/repo.")

    try:
        raw_issues = await github.fetch_issues(repo)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch issues from GitHub: {str(e)}")

    store.clear_repo(repo)
    enriched_issues = []
    for issue in raw_issues:
        status = IssueStatus.OPEN
        if issue.state == "closed":
            status = IssueStatus.RESOLVED

        enriched = EnrichedIssue(
            issue=issue,
            enrichment=IssueEnrichment(),
            status=status,
            repo=repo,
        )
        store.set_issue(repo, enriched)
        enriched_issues.append(enriched)

    return enriched_issues


@router.post("/enrich", response_model=EnrichedIssue)
async def enrich_issue(request: EnrichRequest):
    """AI-enrich a single issue with summary, complexity, impact, etc."""
    ai = get_ai_service()
    github = get_github_service()

    if not ai:
        raise HTTPException(status_code=500, detail="AI service not configured. Set DEVIN_API_TOKEN and DEVIN_ORG_ID.")

    cached = store.get_issue(request.repo, request.issue_number)
    if cached and cached.enrichment.summary:
        return cached

    if not cached:
        if not github:
            raise HTTPException(status_code=500, detail="GitHub service not configured.")
        try:
            issue = await github.get_issue(request.repo, request.issue_number)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch issue: {str(e)}")
    else:
        issue = cached.issue

    try:
        enrichment = await ai.enrich_issue(issue, request.repo)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI enrichment failed: {str(e)}")

    if cached:
        status = cached.status
    else:
        status = IssueStatus.OPEN
        if issue.state == "closed":
            status = IssueStatus.RESOLVED

    enriched = EnrichedIssue(
        issue=issue,
        enrichment=enrichment,
        status=status,
        repo=request.repo,
    )
    store.set_issue(request.repo, enriched)
    return enriched


@router.post("/enrich-all", response_model=list[EnrichedIssue])
async def enrich_all_issues(request: RepoRequest):
    """AI-enrich all cached issues for a repo."""
    ai = get_ai_service()
    if not ai:
        raise HTTPException(status_code=500, detail="AI service not configured. Set DEVIN_API_TOKEN and DEVIN_ORG_ID.")

    issues = store.get_issues(request.repo)
    if not issues:
        raise HTTPException(status_code=404, detail="No issues cached for this repo. Fetch first.")

    enriched_list = []
    for enriched in issues:
        if enriched.enrichment.summary:
            enriched_list.append(enriched)
            continue
        try:
            enrichment = await ai.enrich_issue(enriched.issue, request.repo)
            enriched.enrichment = enrichment
            store.set_issue(request.repo, enriched)
        except Exception:
            pass
        enriched_list.append(enriched)

    return enriched_list


@router.get("/{repo:path}", response_model=list[EnrichedIssue])
async def get_cached_issues(repo: str):
    """Get cached enriched issues for a repo."""
    issues = store.get_issues(repo)
    return issues
