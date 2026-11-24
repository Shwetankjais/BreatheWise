"""Separate historical trajectory planning API; public live planner stays gated."""

from breathewise.core.errors import metadata
from breathewise.schemas.common import Envelope
from breathewise.schemas.replay_planning import ReplayIssuePage, ReplayPlan, ReplayPlanRequest
from breathewise.services import replay_planning
from fastapi import APIRouter, Query, Request

router = APIRouter()


@router.get("/models/{model_version}/replay-issues", response_model=Envelope[ReplayIssuePage])
def issues(
    request: Request,
    model_version: str,
    split: str = Query("test", max_length=40),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0, le=1000000),
):
    return Envelope(
        meta=metadata(
            request, "complete historical single-issue forecast trajectories; not live planning"
        ),
        data=replay_planning.issues(model_version, split, limit, offset),
    )


@router.post("/activity-plan/replay", response_model=Envelope[ReplayPlan])
def plan(request: Request, body: ReplayPlanRequest):
    return Envelope(
        meta=metadata(
            request,
            "historical forecast-only concentration-time comparison; no current safety guidance",
        ),
        data=replay_planning.plan(body),
    )
