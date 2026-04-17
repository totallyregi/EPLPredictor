"""Admin/maintenance endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ...config import settings
from ....scripts.fetch_process_epl_data import run_pipeline

router = APIRouter()


class RefreshRequest(BaseModel):
    seasons: int = settings.seasons_to_fetch
    force_refresh: bool = True


@router.post("/admin/refresh-data")
def refresh_data(payload: RefreshRequest, x_refresh_token: str | None = Header(default=None)) -> dict:
    """
    Regenerate historical and training CSV files from Football-Data API.
    Protect this endpoint with REFRESH_API_TOKEN.
    """
    if not settings.refresh_api_token:
        raise HTTPException(status_code=503, detail="REFRESH_API_TOKEN is not configured")
    if x_refresh_token != settings.refresh_api_token:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    try:
        result = run_pipeline(seasons=payload.seasons, force_refresh=payload.force_refresh)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Refresh failed: {exc}") from exc

    return {"ok": True, "result": result}

