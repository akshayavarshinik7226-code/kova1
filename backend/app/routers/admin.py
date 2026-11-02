"""Administrator routes: statistics, moderation, queue and system status."""

from __future__ import annotations

import os
import sqlite3
from datetime import timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import config, db
from ..schemas import ActivityOut, ContactOut, DeploymentOut, ProjectUpdate, UsageStats
from ..services import (
    DEPLOYMENT_SELECT,
    PROJECT_SELECT,
    add_log,
    deployment_logs,
    deployment_payload,
    get_db,
    normalise_queue_positions,
    notify,
    project_payload,
    record_activity,
    require_admin,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _count(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    row = conn.execute(sql, params).fetchone()
    return int(row[0] or 0)


def _activity_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "actor_name": row["actor_name"],
        "action": row["action"],
        "target_type": row["target_type"],
        "target_id": row["target_id"],
        "detail": row["detail"] or "",
        "created_at": row["created_at"],
    }


def _size_of(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


# --- overview ----------------------------------------------------------------


@router.get("/overview")
def overview(
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    since_24h = db.iso(db.utcnow() - timedelta(hours=24))
    since_7d = db.iso(db.utcnow() - timedelta(days=7))

    totals = {
        "students": _count(conn, "SELECT COUNT(*) FROM users WHERE role = 'student'"),
        "admins": _count(conn, "SELECT COUNT(*) FROM users WHERE role = 'admin'"),
        "suspended_students": _count(
            conn, "SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'suspended'"
        ),
        "projects": _count(conn, "SELECT COUNT(*) FROM projects"),
        "active_projects": _count(conn, "SELECT COUNT(*) FROM projects WHERE status = 'active'"),
        "deployments": _count(conn, "SELECT COUNT(*) FROM deployments"),
        "queued": _count(conn, "SELECT COUNT(*) FROM deployments WHERE status = 'queued'"),
        "failed": _count(conn, "SELECT COUNT(*) FROM deployments WHERE status = 'failed'"),
        "ready": _count(conn, "SELECT COUNT(*) FROM deployments WHERE status = 'ready'"),
        "deployments_24h": _count(
            conn, "SELECT COUNT(*) FROM deployments WHERE created_at >= ?", (since_24h,)
        ),
        "deployments_7d": _count(
            conn, "SELECT COUNT(*) FROM deployments WHERE created_at >= ?", (since_7d,)
        ),
        "open_messages": _count(
            conn, "SELECT COUNT(*) FROM contact_messages WHERE status = 'new'"
        ),
    }

    status_rows = conn.execute(
        "SELECT status, COUNT(*) AS count FROM deployments GROUP BY status"
    ).fetchall()
    status_breakdown = {row["status"]: row["count"] for row in status_rows}

    source_rows = conn.execute(
        "SELECT source_type, COUNT(*) AS count FROM projects GROUP BY source_type"
    ).fetchall()
    source_breakdown = {row["source_type"]: row["count"] for row in source_rows}

    recent_deployments = [
        deployment_payload(row)
        for row in conn.execute(
            DEPLOYMENT_SELECT + " ORDER BY d.created_at DESC LIMIT 8"
        ).fetchall()
    ]
    recent_activity = [
        _activity_payload(row)
        for row in conn.execute(
            "SELECT * FROM activity_events ORDER BY created_at DESC LIMIT 10"
        ).fetchall()
    ]
    queue = [
        deployment_payload(row)
        for row in conn.execute(
            DEPLOYMENT_SELECT
            + " WHERE d.status IN ('queued', 'building') ORDER BY d.queue_position ASC LIMIT 20"
        ).fetchall()
    ]

    return {
        "totals": totals,
        "status_breakdown": status_breakdown,
        "source_breakdown": source_breakdown,
        "recent_deployments": recent_deployments,
        "recent_activity": recent_activity,
        "queue": queue,
        "provider": {
            "name": config.DEPLOY_PROVIDER,
            "label": config.DEPLOY_PROVIDER_LABEL,
            "configured": config.DEPLOY_PROVIDER_CONFIGURED,
            "blocked_reason": config.DEPLOY_BLOCKED_REASON,
        },
    }


# --- students ----------------------------------------------------------------


@router.get("/students")
def list_students(
    search: Optional[str] = Query(default=None, max_length=120),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    query = """
    SELECT u.*,
           (SELECT COUNT(*) FROM projects p WHERE p.owner_id = u.id) AS project_count,
           (SELECT COUNT(*) FROM deployments d WHERE d.owner_id = u.id) AS deployment_count,
           (SELECT COUNT(*) FROM deployments d WHERE d.owner_id = u.id
                AND d.status = 'queued') AS queued_count
    FROM users u
    WHERE 1 = 1
    """
    params: list[object] = []
    if search:
        like = f"%{search.strip()}%"
        query += " AND (u.name LIKE ? OR u.email LIKE ? OR u.university LIKE ?)"
        params.extend([like, like, like])
    if status_filter in {"active", "suspended"}:
        query += " AND u.status = ?"
        params.append(status_filter)
    query += " ORDER BY u.created_at DESC"

    rows = conn.execute(query, params).fetchall()
    students = []
    for row in rows:
        students.append(
            {
                "id": row["id"],
                "email": row["email"],
                "name": row["name"],
                "role": row["role"],
                "status": row["status"],
                "university": row["university"],
                "bio": row["bio"],
                "avatar_color": row["avatar_color"],
                "notify_deployments": bool(row["notify_deployments"]),
                "notify_product": bool(row["notify_product"]),
                "is_demo": bool(row["is_demo"]),
                "created_at": row["created_at"],
                "last_login_at": row["last_login_at"],
                "project_count": row["project_count"],
                "deployment_count": row["deployment_count"],
                "queued_count": row["queued_count"],
            }
        )
    return students


@router.patch("/students/{student_id}")
def update_student(
    student_id: str,
    payload: dict,
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = conn.execute("SELECT * FROM users WHERE id = ?", (student_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Student not found")

    updates: dict[str, object] = {}
    new_status = payload.get("status")
    new_role = payload.get("role")
    if new_status is not None:
        if new_status not in {"active", "suspended"}:
            raise HTTPException(status_code=422, detail="Unsupported status")
        if new_status == "suspended" and row["id"] == admin["id"]:
            raise HTTPException(status_code=409, detail="You cannot suspend your own account")
        updates["status"] = new_status
    if new_role is not None:
        if new_role not in {"student", "admin"}:
            raise HTTPException(status_code=422, detail="Unsupported role")
        if row["id"] == admin["id"] and new_role != "admin":
            raise HTTPException(status_code=409, detail="You cannot demote your own account")
        if row["role"] == "admin" and new_role == "student":
            admin_count = _count(conn, "SELECT COUNT(*) FROM users WHERE role = 'admin'")
            if admin_count <= 1:
                raise HTTPException(status_code=409, detail="At least one administrator is required")
        updates["role"] = new_role

    if not updates:
        raise HTTPException(status_code=400, detail="No supported fields supplied")

    assignments = ", ".join(f"{column} = ?" for column in updates)
    conn.execute(
        f"UPDATE users SET {assignments} WHERE id = ?", (*updates.values(), student_id)
    )
    detail = ", ".join(f"{key}={value}" for key, value in updates.items())
    record_activity(
        conn,
        actor=admin,
        action="admin.student_updated",
        target_type="user",
        target_id=student_id,
        detail=f"{row['name']}: {detail}",
    )
    if updates.get("status") == "suspended":
        notify(
            conn,
            user_id=student_id,
            kind="system",
            title="Account suspended",
            body="Your KOVA account was suspended by a platform administrator.",
        )
    refreshed = conn.execute("SELECT * FROM users WHERE id = ?", (student_id,)).fetchone()
    return {"ok": True, "id": refreshed["id"], "status": refreshed["status"], "role": refreshed["role"]}


@router.delete("/students/{student_id}")
def delete_student(
    student_id: str,
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = conn.execute("SELECT * FROM users WHERE id = ?", (student_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Student not found")
    if row["id"] == admin["id"]:
        raise HTTPException(status_code=409, detail="You cannot delete your own account")
    if row["role"] == "admin":
        admin_count = _count(conn, "SELECT COUNT(*) FROM users WHERE role = 'admin'")
        if admin_count <= 1:
            raise HTTPException(status_code=409, detail="At least one administrator is required")
    conn.execute("DELETE FROM users WHERE id = ?", (student_id,))
    record_activity(
        conn,
        actor=admin,
        action="admin.student_deleted",
        target_type="user",
        target_id=student_id,
        detail=f"Deleted account {row['name']} ({row['email']})",
    )
    return {"ok": True}


# --- projects ----------------------------------------------------------------


@router.get("/projects")
def admin_projects(
    search: Optional[str] = Query(default=None, max_length=120),
    source: Optional[str] = Query(default=None, pattern="^(github|zip)$"),
    source_type: Optional[str] = Query(default=None, include_in_schema=False),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    source_filter = source or source_type
    clauses: list[str] = []
    params: list[object] = []
    if search:
        like = f"%{search.strip()}%"
        clauses.append("(p.name LIKE ? OR p.repo_url LIKE ? OR u.name LIKE ?)")
        params.extend([like, like, like])
    if source_type in {"github", "zip"}:
        clauses.append("p.source_type = ?")
        params.append(source_type)
    if status_filter in {"active", "archived"}:
        clauses.append("p.status = ?")
        params.append(status_filter)
    query = PROJECT_SELECT
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY p.updated_at DESC"
    return [project_payload(row) for row in conn.execute(query, params).fetchall()]


@router.patch("/projects/{project_id}")
def admin_update_project(
    project_id: str,
    payload: ProjectUpdate,
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    updates: dict[str, object] = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.status is not None:
        updates["status"] = payload.status
    if not updates:
        raise HTTPException(status_code=400, detail="No supported fields supplied")
    updates["updated_at"] = db.iso()
    assignments = ", ".join(f"{column} = ?" for column in updates)
    conn.execute(
        f"UPDATE projects SET {assignments} WHERE id = ?", (*updates.values(), project_id)
    )
    record_activity(
        conn,
        actor=admin,
        action="admin.project_updated",
        target_type="project",
        target_id=project_id,
        detail=f"{row['name']}: {', '.join(updates.keys())}",
    )
    refreshed = conn.execute(PROJECT_SELECT + " WHERE p.id = ?", (project_id,)).fetchone()
    return project_payload(refreshed)


@router.delete("/projects/{project_id}")
def admin_delete_project(
    project_id: str,
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    record_activity(
        conn,
        actor=admin,
        action="admin.project_deleted",
        target_type="project",
        target_id=project_id,
        detail=f"Removed project {row['name']}",
    )
    return {"ok": True}


# --- deployments -------------------------------------------------------------


@router.get("/deployments")
def admin_deployments(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None, max_length=120),
    limit: int = Query(default=150, ge=1, le=400),
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    clauses: list[str] = []
    params: list[object] = []
    if status_filter and status_filter != "all":
        statuses = [
            value
            for value in status_filter.split(",")
            if value in {"queued", "building", "ready", "failed", "canceled", "expired"}
        ]
        if statuses:
            placeholders = ", ".join("?" for _ in statuses)
            clauses.append(f"d.status IN ({placeholders})")
            params.extend(statuses)
    if search:
        like = f"%{search.strip()}%"
        clauses.append("(p.name LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR d.id LIKE ?)")
        params.extend([like, like, like, like])
    query = DEPLOYMENT_SELECT
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY d.created_at DESC LIMIT ?"
    params.append(limit)
    return [deployment_payload(row) for row in conn.execute(query, params).fetchall()]


@router.get("/queue")
def deployment_queue(
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    rows = conn.execute(
        DEPLOYMENT_SELECT
        + " WHERE d.status IN ('queued', 'building') ORDER BY d.queue_position ASC"
    ).fetchall()
    normalise_queue_positions(conn)
    return {
        "items": [deployment_payload(row) for row in rows],
        "provider": {
            "configured": config.DEPLOY_PROVIDER_CONFIGURED,
            "label": config.DEPLOY_PROVIDER_LABEL,
            "blocked_reason": config.DEPLOY_BLOCKED_REASON,
        },
        "note": (
            "Deployments remain in this queue until build infrastructure is connected. "
            "KOVA never advances a deployment without a real build."
        ),
    }


@router.get("/failed")
def failed_deployments(
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    rows = conn.execute(
        DEPLOYMENT_SELECT + " WHERE d.status = 'failed' ORDER BY d.created_at DESC LIMIT 100"
    ).fetchall()
    return {
        "items": [deployment_payload(row) for row in rows],
        "note": (
            "No builds have executed yet: the build provider is not connected, so KOVA "
            "cannot report build failures. This view fills once Cloudflare integration lands."
        ),
    }


@router.post("/deployments/{deployment_id}/cancel")
def admin_cancel_deployment(
    deployment_id: str,
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = conn.execute(
        DEPLOYMENT_SELECT + " WHERE d.id = ?", (deployment_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Deployment not found")
    if row["status"] not in {"queued", "building"}:
        raise HTTPException(status_code=409, detail="Only queued deployments can be cancelled")
    conn.execute(
        "UPDATE deployments SET status = 'canceled', queue_position = NULL, updated_at = ? WHERE id = ?",
        (db.iso(), deployment_id),
    )
    add_log(
        conn,
        deployment_id,
        "cancel",
        "Deployment removed from the queue by a platform administrator.",
        level="warn",
    )
    normalise_queue_positions(conn)
    notify(
        conn,
        user_id=row["owner_id"],
        kind="deployment",
        title="Deployment cancelled by admin",
        body=f"An administrator removed the deployment for {row['project_name']} from the queue.",
        link=f"/app/deployments/{deployment_id}",
    )
    record_activity(
        conn,
        actor=admin,
        action="admin.deployment_cancelled",
        target_type="deployment",
        target_id=deployment_id,
        detail=f"{row['project_name']} removed from queue",
    )
    refreshed = conn.execute(DEPLOYMENT_SELECT + " WHERE d.id = ?", (deployment_id,)).fetchone()
    payload = deployment_payload(refreshed)
    payload["logs"] = deployment_logs(conn, deployment_id)
    return payload


# --- activity, usage, system --------------------------------------------------


@router.get("/activity", response_model=list[ActivityOut])
def activity_log(
    search: Optional[str] = Query(default=None, max_length=120),
    action: Optional[str] = Query(default=None, max_length=60),
    limit: int = Query(default=100, ge=1, le=400),
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    clauses: list[str] = []
    params: list[object] = []
    if search:
        like = f"%{search.strip()}%"
        clauses.append("(actor_name LIKE ? OR detail LIKE ? OR action LIKE ?)")
        params.extend([like, like, like])
    if action:
        clauses.append("action LIKE ?")
        params.append(f"{action}%")
    query = "SELECT * FROM activity_events"
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    return [_activity_payload(row) for row in conn.execute(query, params).fetchall()]


@router.get("/usage", response_model=UsageStats)
def usage_stats(
    days: int = Query(default=14, ge=7, le=90),
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    start = (db.utcnow() - timedelta(days=days - 1)).date()
    rows = conn.execute(
        """SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
           FROM deployments WHERE created_at >= ? GROUP BY day""",
        (db.iso(db.utcnow() - timedelta(days=days)),),
    ).fetchall()
    counts = {row["day"]: row["count"] for row in rows}
    series = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).isoformat()
        series.append({"date": day, "count": counts.get(day, 0)})

    source_rows = conn.execute(
        "SELECT source_type, COUNT(*) AS count FROM projects GROUP BY source_type"
    ).fetchall()
    top_rows = conn.execute(
        """SELECT u.id, u.name, u.email,
                  (SELECT COUNT(*) FROM projects p WHERE p.owner_id = u.id) AS projects,
                  (SELECT COUNT(*) FROM deployments d WHERE d.owner_id = u.id) AS deployments
           FROM users u WHERE u.role = 'student'
           ORDER BY deployments DESC, projects DESC LIMIT 5"""
    ).fetchall()

    return {
        "range_days": days,
        "deployments_by_day": series,
        "projects_by_source": {row["source_type"]: row["count"] for row in source_rows},
        "top_students": [
            {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "projects": row["projects"],
                "deployments": row["deployments"],
            }
            for row in top_rows
        ],
        "limits": {
            "max_upload_mb": config.MAX_UPLOAD_BYTES // (1024 * 1024),
            "preview_ttl_hours": config.PREVIEW_TTL_HOURS,
        },
    }


@router.get("/system")
def system_status(
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    db_size = _size_of(str(config.DB_PATH))
    backups = sorted(config.DATA_DIR.glob("*.db-wal"))
    deploy_count = _count(conn, "SELECT COUNT(*) FROM deployments")
    return {
        "version": config.APP_VERSION,
        "environment": os.getenv("KOVA_ENV", "development"),
        "database": f"SQLite · {db_size / 1024:.1f} KiB on this instance",
        "deploy_provider": {
            "name": config.DEPLOY_PROVIDER,
            "label": config.DEPLOY_PROVIDER_LABEL,
            "configured": config.DEPLOY_PROVIDER_CONFIGURED,
            "blocked_reason": config.DEPLOY_BLOCKED_REASON,
        },
        "preview_ttl_hours": config.PREVIEW_TTL_HOURS,
        "messaging": {
            "in_app": "active",
            "email": "not configured — email delivery is a later phase",
        },
        "storage": {
            "data_dir": str(config.DATA_DIR),
            "database_size_bytes": db_size,
            "wal_files": len(backups),
            "uploads": "metadata only — archives are validated in memory, not stored",
        },
        "deployments_recorded": deploy_count,
    }


# --- support messages --------------------------------------------------------


@router.get("/messages", response_model=list[ContactOut])
def list_messages(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    query = "SELECT * FROM contact_messages"
    params: list[object] = []
    if status_filter in {"new", "reviewing", "resolved"}:
        query += " WHERE status = ?"
        params.append(status_filter)
    query += " ORDER BY created_at DESC LIMIT 200"
    rows = conn.execute(query, params).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "topic": row["topic"],
            "message": row["message"],
            "status": row["status"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


@router.patch("/messages/{message_id}")
def update_message(
    message_id: str,
    payload: dict,
    admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    new_status = payload.get("status")
    if new_status not in {"new", "reviewing", "resolved"}:
        raise HTTPException(status_code=422, detail="Unsupported message status")
    cursor = conn.execute(
        "UPDATE contact_messages SET status = ? WHERE id = ?", (new_status, message_id)
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    record_activity(
        conn,
        actor=admin,
        action="admin.message_updated",
        target_type="message",
        target_id=message_id,
        detail=f"Support message marked {new_status}",
    )
    return {"ok": True, "status": new_status}
