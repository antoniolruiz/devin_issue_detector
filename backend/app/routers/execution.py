from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    ExecuteRequest,
    PRActionRequest,
    ExecutionSession,
    ExecutionStatus,
    PRAction,
    IssueStatus,
)
from app.store import store
from app.dependencies import get_devin_service, get_github_service

router = APIRouter(prefix="/api/execute", tags=["execution"])


@router.post("/start", response_model=ExecutionSession)
async def start_execution(request: ExecuteRequest):
    """Start a Devin execution session after plan approval."""
    scoping = store.get_scoping_session(request.scoping_session_id)
    if not scoping:
        raise HTTPException(status_code=404, detail="Scoping session not found.")

    if scoping.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Scoping session must be approved before execution. Current status: {scoping.status}",
        )

    devin = get_devin_service()
    if not devin:
        raise HTTPException(
            status_code=500,
            detail="Devin service not configured. Set DEVIN_API_TOKEN and DEVIN_ORG_ID.",
        )

    session = store.create_execution_session(
        scoping_session_id=request.scoping_session_id,
        repo=scoping.repo,
        issue_number=scoping.issue_number,
    )

    plan_text = ""
    if scoping.plan:
        plan_text = f"""
Approved Plan:
- Affected files: {', '.join(scoping.plan.affected_files)}
- Steps: {chr(10).join(f'  {i+1}. {s}' for i, s in enumerate(scoping.plan.step_by_step_plan))}
- Files to modify: {', '.join(scoping.plan.files_to_modify)}
- Risks: {', '.join(scoping.plan.risks_and_assumptions) if scoping.plan.risks_and_assumptions else 'None identified'}
"""

    prompt = f"""Implement the approved plan for GitHub issue #{scoping.issue_number} in repository {scoping.repo}.

{plan_text}

Requirements:
1. Implement the code changes as specified in the plan
2. Add or update tests to cover the changes
3. Ensure CI passes
4. Open a Pull Request with:
   - Link to issue #{scoping.issue_number}
   - Change summary
   - Test results

If you need to deviate from the plan, document the deviation and reason."""

    try:
        devin_response = await devin.create_session(
            prompt=prompt,
            repos=[scoping.repo],
            title=f"Execute: {scoping.repo}#{scoping.issue_number}",
            tags=["execution", f"issue-{scoping.issue_number}"],
        )
        session.devin_session_id = devin_response.get("session_id", "")
        session.devin_session_url = devin_response.get("url", "")
        session.status = ExecutionStatus.RUNNING
        session.conversation.append({
            "role": "system",
            "content": f"Execution session started for issue #{scoping.issue_number}",
        })
    except Exception as e:
        session.status = ExecutionStatus.FAILED
        session.conversation.append({
            "role": "error",
            "content": f"Failed to start Devin execution: {str(e)}",
        })

    if session.status == ExecutionStatus.RUNNING:
        cached_issue = store.get_issue(scoping.repo, scoping.issue_number)
        if cached_issue:
            cached_issue.status = IssueStatus.IN_PROGRESS
            store.set_issue(scoping.repo, cached_issue)

    return session


@router.get("/{session_id}", response_model=ExecutionSession)
async def get_execution_session(session_id: str):
    """Get the status and details of an execution session."""
    session = store.get_execution_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Execution session not found.")

    devin = get_devin_service()
    if devin and session.devin_session_id and session.status == ExecutionStatus.RUNNING:
        try:
            devin_status = await devin.get_session(session.devin_session_id)
            devin_state = devin_status.get("status", "")

            prs = devin_status.get("pull_requests", [])
            if prs:
                pr = prs[0]
                session.pr_url = pr.get("pr_url", "")
                pr_url = session.pr_url
                if pr_url and "/pull/" in pr_url:
                    try:
                        session.pr_number = int(pr_url.split("/pull/")[-1])
                    except ValueError:
                        pass

            if devin_state in ("exit", "suspended"):
                if session.pr_url:
                    session.status = ExecutionStatus.SUCCESS
                    github = get_github_service()
                    if github and session.pr_number:
                        try:
                            diff = await github.get_pr_diff(session.repo, session.pr_number)
                            session.diff_summary = diff[:5000]
                        except Exception:
                            pass
                else:
                    session.status = ExecutionStatus.PARTIAL
            elif devin_state == "error":
                session.status = ExecutionStatus.FAILED

        except Exception:
            pass

    return session


@router.post("/{session_id}/pr-action", response_model=ExecutionSession)
async def pr_action(session_id: str, request: PRActionRequest):
    """Perform an action on the PR (accept, request changes, reject)."""
    session = store.get_execution_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Execution session not found.")

    github = get_github_service()
    if not github:
        raise HTTPException(status_code=500, detail="GitHub service not configured.")

    if not session.pr_number:
        raise HTTPException(status_code=400, detail="No PR associated with this execution session.")

    devin = get_devin_service()

    if request.action == PRAction.ACCEPT:
        try:
            await github.merge_pr(session.repo, session.pr_number)
            session.conversation.append({
                "role": "user",
                "content": "PR accepted and merged.",
            })
            cached_issue = store.get_issue(session.repo, session.issue_number)
            if cached_issue:
                cached_issue.status = IssueStatus.RESOLVED
                store.set_issue(session.repo, cached_issue)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to merge PR: {str(e)}")

    elif request.action == PRAction.REQUEST_CHANGES:
        try:
            await github.comment_on_pr(
                session.repo,
                session.pr_number,
                f"Changes requested:\n\n{request.feedback}",
            )
            session.conversation.append({
                "role": "user",
                "content": f"Changes requested: {request.feedback}",
            })
            if devin and session.devin_session_id:
                try:
                    await devin.send_message(
                        session.devin_session_id,
                        f"The user has requested changes on the PR:\n{request.feedback}\nPlease make a follow-up commit addressing this feedback.",
                    )
                    session.status = ExecutionStatus.RUNNING
                    session.conversation.append({
                        "role": "devin",
                        "content": "Devin is working on the requested changes.",
                    })
                except Exception:
                    pass
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to comment on PR: {str(e)}")

    elif request.action == PRAction.REJECT:
        try:
            await github.close_pr(session.repo, session.pr_number)
            session.conversation.append({
                "role": "user",
                "content": f"PR rejected and closed. {request.feedback}",
            })
            session.status = ExecutionStatus.FAILED
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to close PR: {str(e)}")

    return session
