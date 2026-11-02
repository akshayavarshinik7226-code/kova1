"""Deployment routes: queueing, listing, details, logs, cancel and retry."""

from __future__ import annotations

import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import db
from ..schemas import DeploymentDetail, DeploymentOut, LogEntry, NewDeploymentRequest
from ..services import (
    DEPLOYMENT_SELECT,
    add_log,
    create_deployment,
    deployment_logs,
    deployment_payload,
    get_current_user,
    get_db,
    get_deployment,
    get_owned_project,
    normalise_queue_positions,
    notify,
    record_activity,
)

router = APIRouter(prefix="/deployments", tags=["deployments"])

VALID_STATUSES = {"queued", "building", "ready", "failed", "canceled", "expired"}


@router.get("", response_model=list[DeploymentOut])
def list_deployments(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    project_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=300),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    clauses: list[str] = []
    params: list[object] = []
    if user["role"] != "admin":
        clauses.append("d.owner_id = ?")
        params.append(user["id"])
    if status_filter and status_filter != "all":
        statuses = [value for value in status_filter.split(",") if value in VALID_STATUSES]
        if statuses:
            placeholders = ", ".join("?" for _ in statuses)
            clauses.append(f"d.status IN ({placeholders})")
            params.extend(statuses)
    if project_id:
        clauses.append("d.project_id = ?")
        params.append(project_id)
    if search:
        like = f"%{search.strip()}%"
        clauses.append("(p.name LIKE ? OR d.id LIKE ? OR d.source_label LIKE ?)")
        params.extend([like, like, like])

    query = DEPLOYMENT_SELECT
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY CASE WHEN d.status = 'queued' THEN 0 ELSE 1 END, d.created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    return [deployment_payload(row) for row in rows]


@router.post("", response_model=DeploymentDetail, status_code=201)
def queue_deployment(
    payload: NewDeploymentRequest,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    project = get_owned_project(conn, payload.project_id, user)
    row = create_deployment(
        conn,
        project=project,
        actor=user,
        environment=payload.environment,
        commit_ref=payload.commit_ref,
    )
    normalise_queue_positions(conn)
    refreshed = conn.execute(DEPLOYMENT_SELECT + " WHERE d.id = ?", (row["id"],)).fetchone()
    result = deployment_payload(refreshed)
    result["logs"] = deployment_logs(conn, row["id"])
    return result


@router.get("/{deployment_id}", response_model=DeploymentDetail)
def deployment_detail(
    deployment_id: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = get_deployment(conn, deployment_id, user)
    payload = deployment_payload(row)
    payload["logs"] = deployment_logs(conn, deployment_id)
    return payload


@router.get("/{deployment_id}/logs", response_model=list[LogEntry])
def get_logs(
    deployment_id: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    get_deployment(conn, deployment_id, user)
    return deployment_logs(conn, deployment_id)


@router.post("/{deployment_id}/cancel", response_model=DeploymentDetail)
def cancel_deployment(
    deployment_id: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = get_deployment(conn, deployment_id, user)
    if row["status"] not in {"queued", "building"}:
        raise HTTPException(
            status_code=409,
            detail=f"Deployment cannot be cancelled while it is {row['status']}",
        )
    conn.execute(
        "UPDATE deployments SET status = 'canceled', queue_position = NULL, updated_at = ? WHERE id = ?",
        (db.iso(), deployment_id),
    )
    add_log(conn, deployment_id, "cancel", "Deployment removed from the queue by the owner.")
    normalise_queue_positions(conn)
    notify(
        conn,
        user_id=row["owner_id"],
        kind="deployment",
        title="Deployment cancelled",
        body=f"Deployment for {row['project_name']} was cancelled and left the queue.",
        link=f"/app/deployments/{deployment_id}",
    )
    record_activity(
        conn,
        actor=user,
        action="deployment.cancelled",
        target_type="deployment",
        target_id=deployment_id,
        detail=f"{row['project_name']} removed from queue",
    )
    refreshed = conn.execute(DEPLOYMENT_SELECT + " WHERE d.id = ?", (deployment_id,)).fetchone()
    payload = deployment_payload(refreshed)
    payload["logs"] = deployment_logs(conn, deployment_id)
    return payload


@router.post("/{deployment_id}/retry", response_model=DeploymentDetail, status_code=201)
def retry_deployment(
    deployment_id: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = get_deployment(conn, deployment_id, user)
    if row["status"] not in {"failed", "canceled", "expired"}:
        raise HTTPException(
            status_code=409,
            detail="Only failed, cancelled or expired deployments can be retried",
        )
    project = get_owned_project(conn, row["project_id"], user)
    created = create_deployment(
        conn,
        project=project,
        actor=user,
        environment=row["environment"],
        commit_ref=row["commit_ref"],
    )
    add_log(
        conn,
        created["id"],
        "retry",
        f"Retry of deployment {deployment_id}.",
    )
    normalise_queue_positions(conn)
    refreshed = conn.execute(
        DEPLOYMENT_SELECT + " WHERE d.id = ?", (created["id"],)
    ).fetchone()
    payload = deployment_payload(refreshed)
    payload["logs"] = deployment_logs(conn, created["id"])
    return payload
