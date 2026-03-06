"""Service dependency management with runtime configuration."""

import os
from typing import Optional
from dotenv import load_dotenv

from app.services.github_service import GitHubService
from app.services.devin_service import DevinService
from app.services.ai_service import AIService
from app.models.schemas import ConfigRequest

load_dotenv()

_config = {
    "github_token": os.getenv("GITHUB_TOKEN", ""),
    "devin_api_token": os.getenv("DEVIN_API_TOKEN", ""),
    "devin_org_id": os.getenv("DEVIN_ORG_ID", ""),
}

_github_service: Optional[GitHubService] = None
_devin_service: Optional[DevinService] = None
_ai_service: Optional[AIService] = None


def _rebuild_services():
    global _github_service, _devin_service, _ai_service

    token = _config.get("github_token", "")
    _github_service = GitHubService(token=token if token else None)

    devin_token = _config.get("devin_api_token", "")
    devin_org = _config.get("devin_org_id", "")
    if devin_token and devin_org:
        _devin_service = DevinService(api_token=devin_token, org_id=devin_org)
        _ai_service = AIService(devin_service=_devin_service)
    else:
        _devin_service = None
        _ai_service = None


_rebuild_services()


def update_config(request: ConfigRequest):
    if request.github_token:
        _config["github_token"] = request.github_token
    if request.devin_api_token:
        _config["devin_api_token"] = request.devin_api_token
    if request.devin_org_id:
        _config["devin_org_id"] = request.devin_org_id
    _rebuild_services()


def get_config_status() -> dict:
    return {
        "github_configured": bool(_config.get("github_token")),
        "devin_configured": bool(
            _config.get("devin_api_token") and _config.get("devin_org_id")
        ),
    }


def get_github_service() -> Optional[GitHubService]:
    return _github_service


def get_devin_service() -> Optional[DevinService]:
    return _devin_service


def get_ai_service() -> Optional[AIService]:
    return _ai_service
