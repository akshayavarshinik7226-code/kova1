"""Project routes: submission (GitHub URL or ZIP), listing, settings."""

from __future__ import annotations

import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from .. import config, db
from ..schemas import ProjectCreateGithub, ProjectOut, ProjectUpdate
from ..services import (
    PROJECT_SELECT,
    get_current_user,
    get_db,
    get_owned_project,
    inspect_zip,
    notify,
    parse_github_url,
    project_payload,
    record_activity,
    slugify,
    validate_branch,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _unique_slug(conn: sqlite3.Connection, owner_id: str, base: str) -> str:
    slug = slugify(base)
    candidate = slug
    counter = 2
    while conn.execute(
        "SELECT 1 FROM projects WHERE owner_id = ? AND slug = ?", (owner_id, candidate)
    ).fetchone():
        candidate = f"{slug}-{counter}"
        counter += 1
    return candidate


@router.get("", response_model=list[ProjectOut])
def list_projects(
    search: Optional[str] = Query(default=None, max_length=120),
    source: Optional[str] = Query(default=None, pattern="^(github|zip)$"),
    source_type: Optional[str] = Query(default=None, include_in_schema=False),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    source_filter = source or source_type
    clauses: list[str] = []
    params: list[object] = []
    if user["role"] != "admin":
        clauses.append("p.owner_id = ?")
        params.append(user["id"])
    if search:
        clauses.append("(p.name LIKE ? OR p.description LIKE ? OR p.repo_url LIKE ?)")
        like = f"%{search.strip()}%"
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
    rows = conn.execute(query, params).fetchall()
    return [project_payload(row) for row in rows]


@router.post("/github", response_model=ProjectOut, status_code=201)
def create_github_project(
    payload: ProjectCreateGithub,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    try:
        repo_url, owner, repo = parse_github_url(payload.repo_url)
        branch = validate_branch(payload.branch)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    project_id = db.new_id("prj")
    slug = _unique_slug(conn, user["id"], payload.name)
    now = db.iso()
    conn.execute(
        """INSERT INTO projects (id, owner_id, name, slug, description, source_type,
              repo_url, repo_branch, framework, archive_entries, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'github', ?, ?, ?, 0, 'active', ?, ?)""",
        (
            project_id,
            user["id"],
            payload.name.strip(),
            slug,
            payload.description.strip(),
            repo_url,
            branch,
            None,
            now,
            now,
        ),
    )
    record_activity(
        conn,
        actor=user,
        action="project.created",
        target_type="project",
        target_id=project_id,
        detail=f"Linked GitHub repository {owner}/{repo}",
    )
    notify(
        conn,
        user_id=user["id"],
        kind="product",
        title="Project created",
        body=f"{payload.name.strip()} is linked to {owner}/{repo}. You can queue a deployment at any time.",
        link=f"/app/projects/{project_id}",
    )
    row = conn.execute(PROJECT_SELECT + " WHERE p.id = ?", (project_id,)).fetchone()
    return project_payload(row)


@router.post("/zip", response_model=ProjectOut, status_code=201)
async def create_zip_project(
    name: str = Form(..., min_length=2, max_length=80),
    description: str = Form(default="", max_length=400),
    file: UploadFile = File(...),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    payload = await file.read()
    try:
        details = inspect_zip(file.filename or "", payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await file.close()

    project_id = db.new_id("prj")
    slug = _unique_slug(conn, user["id"], name)
    now = db.iso()
    conn.execute(
        """INSERT INTO projects (id, owner_id, name, slug, description, source_type,
              repo_url, repo_branch, framework, zip_filename, archive_entries, status,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'zip', NULL, NULL, ?, ?, ?, 'active', ?, ?)""",
        (
            project_id,
            user["id"],
            name.strip(),
            slug,
            description.strip(),
            details["framework"],
            file.filename,
            details["entries"],
            now,
            now,
        ),
    )
    record_activity(
        conn,
        actor=user,
        action="project.created",
        target_type="project",
        target_id=project_id,
        detail=f"Uploaded archive {file.filename} ({details['entries']} files)",
    )
    notify(
        conn,
        user_id=user["id"],
        kind="product",
        title="Archive validated",
        body=f"{name.strip()} was validated ({details['entries']} files). Queue a deployment when ready.",
        link=f"/app/projects/{project_id}",
    )
    row = conn.execute(PROJECT_SELECT + " WHERE p.id = ?", (project_id,)).fetchone()
    return project_payload(row)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    return project_payload(get_owned_project(conn, project_id, user))


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    project = get_owned_project(conn, project_id, user)
    updates: dict[str, object] = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.branch is not None:
        try:
            updates["repo_branch"] = validate_branch(payload.branch)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if project["source_type"] != "github":
            raise HTTPException(
                status_code=422, detail="Branch can only be changed for GitHub projects"
            )
    if payload.status is not None:
        updates["status"] = payload.status

    if updates:
        updates["updated_at"] = db.iso()
        assignments = ", ".join(f"{column} = ?" for column in updates)
        conn.execute(
            f"UPDATE projects SET {assignments} WHERE id = ?",
            (*updates.values(), project_id),
        )
        record_activity(
            conn,
            actor=user,
            action="project.updated",
            target_type="project",
            target_id=project_id,
            detail=f"Updated {', '.join(updates.keys())}",
        )

    refreshed = conn.execute(PROJECT_SELECT + " WHERE p.id = ?", (project_id,)).fetchone()
    return project_payload(refreshed)


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    project = get_owned_project(conn, project_id, user)
    name = project["name"]
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    record_activity(
        conn,
        actor=user,
        action="project.deleted",
        target_type="project",
        target_id=project_id,
        detail=f"Deleted project {name} and its deployment history",
    )
    return {"ok": True, "message": f"{name} deleted", "max_upload_mb": config.MAX_UPLOAD_BYTES // 1048576}
