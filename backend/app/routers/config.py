from fastapi import APIRouter

from app.models.schemas import ConfigRequest
from app.dependencies import update_config, get_config_status

router = APIRouter(prefix="/api/config", tags=["config"])


@router.post("/update")
async def update_configuration(request: ConfigRequest):
    """Update API configuration (tokens, keys)."""
    update_config(request)
    return {"status": "ok", "message": "Configuration updated."}


@router.get("/status")
async def config_status():
    """Check which services are configured."""
    return get_config_status()
