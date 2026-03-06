from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    ScopeRequest,
    ScopeFeedbackRequest,
    ScopingSession,
    ScopingAction,
    IssueStatus,
)
from app.store import store
from app.dependencies import get_devin_service, get_ai_service, get_github_service

router = APIRouter(prefix="/api/scope", tags=["scoping"])


@router.post("/start", response_model=ScopingSession)
async def start_scoping(request: ScopeRequest):
    """Start a Devin scoping session for an issue."""
    devin = get_devin_service()
    if not devin:
        raise HTTPException(
            status_code=500,
            detail="Devin service not configured. Set DEVIN_API_TOKEN and DEVIN_ORG_ID.",
        )

    github = get_github_service()
    cached_issue = store.get_issue(request.repo, request.issue_number)
    if not cached_issue:
        if not github:
            raise HTTPException(status_code=500, detail="GitHub service not configured.")
        try:
            issue = await github.get_issue(request.repo, request.issue_number)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch issue: {str(e)}")
        issue_title = issue.title
        issue_body = issue.body
    else:
        issue_title = cached_issue.issue.title
        issue_body = cached_issue.issue.body

    session = store.create_scoping_session(request.repo, request.issue_number)

    prompt = f"""Analyze GitHub issue #{request.issue_number} in repository {request.repo}.

Issue Title: {issue_title}
Issue Body:
{issue_body[:2000]}

Please provide a detailed scoping plan with:
1. Affected files and functions (with line numbers where possible)
2. Step-by-step plan of proposed changes
3. Files to be modified or created
4. Confidence score (0-100) with a one-sentence rationale
5. Identified risks or assumptions

DO NOT make any code changes. Only analyze and plan.
Format your response clearly with numbered sections."""

    try:
        devin_response = await devin.create_session(
            prompt=prompt,
            repos=[request.repo],
            title=f"Scoping: {request.repo}#{request.issue_number} - {issue_title}",
            tags=["scoping", f"issue-{request.issue_number}"],
        )
        session.devin_session_id = devin_response.get("session_id", "")
        session.devin_session_url = devin_response.get("url", "")
        session.status = "running"
        session.conversation.append({
            "role": "system",
            "content": f"Scoping session started for issue #{request.issue_number}",
        })
    except Exception as e:
        session.status = "error"
        session.conversation.append({
            "role": "error",
            "content": f"Failed to start Devin session: {str(e)}",
        })

    if cached_issue and session.status == "running":
        cached_issue.status = IssueStatus.IN_PROGRESS
        store.set_issue(request.repo, cached_issue)

    return session


@router.get("/{session_id}", response_model=ScopingSession)
async def get_scoping_session(session_id: str):
    """Get the status and details of a scoping session."""
    session = store.get_scoping_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Scoping session not found.")

    devin = get_devin_service()
    if devin and session.devin_session_id and session.status == "running":
        try:
            devin_status = await devin.get_session(session.devin_session_id)
            devin_state = devin_status.get("status", "")

            if devin_state in ("exit", "suspended"):
                session.status = "completed"
                ai = get_ai_service()
                if ai:
                    status_str = str(devin_status)
                    plan = await ai.parse_scoping_response(status_str)
                    if plan:
                        session.plan = plan
            elif devin_state == "error":
                session.status = "error"
        except Exception:
            pass

    return session


@router.post("/{session_id}/feedback", response_model=ScopingSession)
async def send_feedback(session_id: str, request: ScopeFeedbackRequest):
    """Send feedback on a scoping plan (approve, challenge, modify, reject)."""
    session = store.get_scoping_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Scoping session not found.")

    devin = get_devin_service()

    if request.action == ScopingAction.APPROVE:
        session.status = "approved"
        session.conversation.append({
            "role": "user",
            "content": "Plan approved. Ready for execution.",
        })

    elif request.action == ScopingAction.REJECT:
        session.status = "rejected"
        session.conversation.append({
            "role": "user",
            "content": f"Plan rejected. {request.feedback}",
        })
        if devin and session.devin_session_id:
            try:
                await devin.terminate_session(session.devin_session_id)
            except Exception:
                pass

    elif request.action == ScopingAction.CHALLENGE:
        session.conversation.append({
            "role": "user",
            "content": f"Challenge: {request.feedback}",
        })
        if devin and session.devin_session_id:
            try:
                response = await devin.send_message(
                    session.devin_session_id,
                    f"The user has challenged part of the plan: {request.feedback}\nPlease respond to this feedback and update the plan if needed.",
                )
                session.conversation.append({
                    "role": "devin",
                    "content": f"Devin is processing your challenge. Session status: {response.get('status', 'unknown')}",
                })
                session.status = "running"
            except Exception as e:
                session.conversation.append({
                    "role": "error",
                    "content": f"Failed to send challenge to Devin: {str(e)}",
                })

    elif request.action == ScopingAction.MODIFY:
        session.conversation.append({
            "role": "user",
            "content": f"Modification requested: {request.feedback}",
        })
        if devin and session.devin_session_id:
            try:
                response = await devin.send_message(
                    session.devin_session_id,
                    f"The user requests a scope change: {request.feedback}\nPlease produce a revised plan based on this feedback.",
                )
                session.conversation.append({
                    "role": "devin",
                    "content": f"Devin is producing a revised plan. Session status: {response.get('status', 'unknown')}",
                })
                session.status = "running"
            except Exception as e:
                session.conversation.append({
                    "role": "error",
                    "content": f"Failed to send modification to Devin: {str(e)}",
                })

    return session
