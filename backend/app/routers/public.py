"""Public metadata, health and support contact routes."""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request

from .. import config, db
from ..schemas import ContactRequest, PlatformMeta
from ..services import get_db

router = APIRouter(tags=["public"])

# Simple per-IP throttle so the public contact form cannot be used to flood the
# activity log. Too small to need Redis for a single-instance deployment.
_CONTACT_HITS: dict[str, list[float]] = {}
_CONTACT_WINDOW = 10 * 60
_CONTACT_LIMIT = 5


@router.get("/meta", response_model=PlatformMeta)
def platform_meta():
    return {
        "name": config.APP_NAME,
        "version": config.APP_VERSION,
        "stage": "Stage 1 · interface and control plane",
        "preview_ttl_hours": config.PREVIEW_TTL_HOURS,
        "deploy_provider": {
            "name": config.DEPLOY_PROVIDER,
            "label": config.DEPLOY_PROVIDER_LABEL,
            "configured": config.DEPLOY_PROVIDER_CONFIGURED,
            "blocked_reason": config.DEPLOY_BLOCKED_REASON,
        },
        "demo_enabled": config.SEED_DEMO_DATA,
        "features": {
            "github_submission": True,
            "zip_submission": True,
            "deployment_queue": True,
            "build_execution": False,
            "preview_urls": False,
            "custom_domains": False,
            "email_delivery": False,
        },
    }


@router.get("/health")
def health(conn: sqlite3.Connection = Depends(get_db)):
    conn.execute("SELECT 1")
    return {"status": "ok", "version": config.APP_VERSION}


@router.get("/status")
def public_status(conn: sqlite3.Connection = Depends(get_db)):
    queued = conn.execute(
        "SELECT COUNT(*) AS count FROM deployments WHERE status = 'queued'"
    ).fetchone()["count"]
    return {
        "api": {"state": "operational", "label": "API responding"},
        "database": {"state": "operational", "label": "SQLite reachable"},
        "queue": {"state": "paused", "label": "Queue intake only", "queued": queued},
        "builds": {
            "state": "pending_integration",
            "label": config.DEPLOY_PROVIDER_LABEL,
            "detail": config.DEPLOY_BLOCKED_REASON,
        },
        "preview_urls": {
            "state": "pending_integration",
            "label": "No live URLs issued in Stage 1",
        },
        "email": {"state": "not_configured", "label": "In-app notifications only"},
    }


@router.post("/contact", status_code=201)
def submit_contact(payload: ContactRequest, request: Request, conn: sqlite3.Connection = Depends(get_db)):
    import time

    client = request.client.host if request.client else "unknown"
    now = time.time()
    hits = [stamp for stamp in _CONTACT_HITS.get(client, []) if now - stamp < _CONTACT_WINDOW]
    if len(hits) >= _CONTACT_LIMIT:
        raise HTTPException(
            status_code=429, detail="Too many messages from this address. Try again later."
        )
    hits.append(now)
    _CONTACT_HITS[client] = hits

    message_id = db.new_id("msg")
    conn.execute(
        """INSERT INTO contact_messages (id, name, email, topic, message, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'new', ?)""",
        (
            message_id,
            payload.name.strip(),
            str(payload.email).lower(),
            payload.topic,
            payload.message.strip(),
            db.iso(),
        ),
    )
    conn.execute(
        """INSERT INTO activity_events (id, actor_id, actor_name, action, target_type,
              target_id, detail, created_at)
           VALUES (?, NULL, ?, 'support.message_received', 'message', ?, ?, ?)""",
        (
            db.new_id("evt"),
            payload.name.strip(),
            message_id,
            f"{payload.topic} enquiry from {payload.email}",
            db.iso(),
        ),
    )
    return {
        "ok": True,
        "id": message_id,
        "message": "Message received. Support replies through the email address you provided.",
    }
