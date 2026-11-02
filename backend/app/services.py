"""Shared service helpers: auth dependencies, validation, serialisation."""

from __future__ import annotations

import io
import re
import sqlite3
import zipfile
from datetime import datetime, timedelta
from typing import Any, Iterator, Optional
from urllib.parse import urlparse

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config, db
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

GITHUB_HOSTS = {"github.com", "www.github.com"}
REPO_SEGMENT = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
BRANCH_PATTERN = re.compile(r"^[A-Za-z0-9._/-]{1,80}$")
SLUG_PATTERN = re.compile(r"[^a-z0-9]+")

FRAMEWORK_MARKERS = [
    ("next.config", "Next.js"),
    ("nuxt.config", "Nuxt"),
    ("vite.config", "Vite"),
    ("svelte.config", "SvelteKit"),
    ("astro.config", "Astro"),
    ("angular.json", "Angular"),
    ("manage.py", "Django"),
    ("streamlit", "Streamlit"),
    ("requirements.txt", "Python"),
    ("pyproject.toml", "Python"),
    ("package.json", "Node.js"),
    ("cargo.toml", "Rust"),
    ("go.mod", "Go"),
    ("index.html", "Static HTML"),
]


# --- database dependency ------------------------------------------------------


def get_db() -> Iterator[sqlite3.Connection]:
    with db.connect() as conn:
        yield conn


# --- auth dependencies --------------------------------------------------------


def _user_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
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
    }


def public_user(row: sqlite3.Row) -> dict[str, Any]:
    return _user_payload(row)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    conn: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired, please sign in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
    row = conn.execute("SELECT * FROM users WHERE id = ?", (payload.get("sub"),)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Account not found")
    if row["status"] == "suspended":
        raise HTTPException(
            status_code=403,
            detail="This account is suspended. Contact platform support.",
        )
    return row


def require_admin(user: sqlite3.Row = Depends(get_current_user)) -> sqlite3.Row:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


# --- activity + notifications -------------------------------------------------


def record_activity(
    conn: sqlite3.Connection,
    *,
    actor: Optional[sqlite3.Row],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    detail: str = "",
) -> None:
    conn.execute(
        """INSERT INTO activity_events (id, actor_id, actor_name, action, target_type,
              target_id, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            db.new_id("evt"),
            actor["id"] if actor else None,
            actor["name"] if actor else "system",
            action,
            target_type,
            target_id,
            detail,
            db.iso(),
        ),
    )


def notify(
    conn: sqlite3.Connection,
    *,
    user_id: str,
    kind: str,
    title: str,
    body: str,
    link: Optional[str] = None,
) -> None:
    user = conn.execute(
        "SELECT notify_deployments, notify_product FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if user is None:
        return
    if kind == "deployment" and not user["notify_deployments"]:
        return
    if kind == "product" and not user["notify_product"]:
        return
    conn.execute(
        """INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?)""",
        (db.new_id("ntf"), user_id, kind, title, body, link, db.iso()),
    )


# --- validation ---------------------------------------------------------------


def parse_github_url(raw: str) -> tuple[str, str, str]:
    """Validate a public GitHub repository URL and return (clean_url, owner, repo)."""
    candidate = raw.strip()
    if not candidate:
        raise ValueError("Repository URL is required")
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Repository URL must start with https://")
    host = (parsed.hostname or "").lower()
    if host not in GITHUB_HOSTS:
        raise ValueError("Only github.com repository URLs are supported")
    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) < 2:
        raise ValueError("URL must point to a repository, e.g. https://github.com/owner/repo")
    owner, repo = segments[0], segments[1]
    if repo.endswith(".git"):
        repo = repo[: -len(".git")]
    if not REPO_SEGMENT.match(owner) or not REPO_SEGMENT.match(repo):
        raise ValueError("Repository owner or name contains unsupported characters")
    if len(segments) > 2 and segments[2] not in {"tree", "blob"}:
        raise ValueError("Provide the repository root URL, not a file path")
    clean = f"https://github.com/{owner}/{repo}"
    return clean, owner, repo


def validate_branch(branch: str) -> str:
    value = (branch or "").strip() or "main"
    if not BRANCH_PATTERN.match(value) or value.startswith("/") or value.endswith("/"):
        raise ValueError("Branch name contains unsupported characters")
    return value


def slugify(value: str) -> str:
    slug = SLUG_PATTERN.sub("-", value.lower()).strip("-")
    return slug or "project"


def detect_framework(names: list[str]) -> Optional[str]:
    lowered = [name.lower() for name in names]
    for marker, label in FRAMEWORK_MARKERS:
        if any(name.endswith(marker) or marker in name for name in lowered):
            return label
    return None


def inspect_zip(filename: str, payload: bytes) -> dict[str, Any]:
    """Validate an uploaded project archive without extracting or executing it."""
    if not filename.lower().endswith(".zip"):
        raise ValueError("Only .zip archives are supported")
    if not payload:
        raise ValueError("The uploaded archive is empty")
    if len(payload) > config.MAX_UPLOAD_BYTES:
        limit_mb = config.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise ValueError(f"Archive exceeds the {limit_mb} MB limit")
    if not zipfile.is_zipfile(io.BytesIO(payload)):
        raise ValueError("File is not a valid ZIP archive")

    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            entries = archive.infolist()
            if not entries:
                raise ValueError("The archive contains no files")
            if len(entries) > 5000:
                raise ValueError("Archive contains too many files (limit 5000)")
            total_uncompressed = sum(entry.file_size for entry in entries)
            if total_uncompressed > 200 * 1024 * 1024:
                raise ValueError("Uncompressed archive is too large (limit 200 MB)")
            for entry in entries:
                name = entry.filename.replace("\\", "/")
                if ".." in name.split("/"):
                    raise ValueError("Archive contains unsafe paths")
            names = [entry.filename for entry in entries if not entry.is_dir()]
    except zipfile.BadZipFile as exc:  # pragma: no cover - defensive
        raise ValueError("Archive could not be read") from exc

    return {
        "entries": len(names),
        "names": names[:2000],
        "framework": detect_framework(names),
    }


# --- serialisation ------------------------------------------------------------


PROJECT_SELECT = """
SELECT p.*, u.name AS owner_name, u.email AS owner_email,
       (SELECT COUNT(*) FROM deployments d WHERE d.project_id = p.id) AS deployment_count,
       (SELECT d.status FROM deployments d WHERE d.project_id = p.id
            ORDER BY d.created_at DESC LIMIT 1) AS last_deployment_status,
       (SELECT d.created_at FROM deployments d WHERE d.project_id = p.id
            ORDER BY d.created_at DESC LIMIT 1) AS last_deployment_at
FROM projects p
JOIN users u ON u.id = p.owner_id
"""


def project_payload(row: sqlite3.Row) -> dict[str, Any]:
    keys = row.keys()
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "owner_name": row["owner_name"] if "owner_name" in keys else "",
        "owner_email": row["owner_email"] if "owner_email" in keys else "",
        "name": row["name"],
        "slug": row["slug"],
        "description": row["description"] or "",
        "source_type": row["source_type"],
        "repo_url": row["repo_url"],
        "repo_branch": row["repo_branch"],
        "framework": row["framework"],
        "zip_filename": row["zip_filename"],
        "archive_entries": row["archive_entries"],
        "status": row["status"],
        "is_demo": bool(row["is_demo"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "deployment_count": row["deployment_count"] if "deployment_count" in keys else 0,
        "last_deployment_status": (
            row["last_deployment_status"] if "last_deployment_status" in keys else None
        ),
        "last_deployment_at": (
            row["last_deployment_at"] if "last_deployment_at" in keys else None
        ),
    }


DEPLOYMENT_SELECT = """
SELECT d.*, p.name AS project_name, u.name AS owner_name, p.is_demo AS project_is_demo
FROM deployments d
JOIN projects p ON p.id = d.project_id
JOIN users u ON u.id = d.owner_id
"""


def deployment_payload(row: sqlite3.Row) -> dict[str, Any]:
    keys = row.keys()
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "project_name": row["project_name"] if "project_name" in keys else "",
        "owner_id": row["owner_id"],
        "owner_name": row["owner_name"] if "owner_name" in keys else "",
        "status": row["status"],
        "environment": row["environment"],
        "commit_ref": row["commit_ref"],
        "source_label": row["source_label"] or "",
        "provider": row["provider"],
        "provider_state": row["provider_state"],
        "blocked_reason": row["blocked_reason"],
        "preview_url": row["preview_url"],
        "error_code": row["error_code"],
        "error_message": row["error_message"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "expires_at": row["expires_at"],
        "queue_position": row["queue_position"],
        "is_demo": bool(row["project_is_demo"]) if "project_is_demo" in keys else False,
    }


def next_queue_position(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        "SELECT COALESCE(MAX(queue_position), 0) AS position FROM deployments "
        "WHERE status IN ('queued', 'building')"
    ).fetchone()
    return int(row["position"] or 0) + 1


def normalise_queue_positions(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        "SELECT id FROM deployments WHERE status IN ('queued', 'building') "
        "ORDER BY created_at ASC"
    ).fetchall()
    for index, row in enumerate(rows, start=1):
        conn.execute(
            "UPDATE deployments SET queue_position = ? WHERE id = ?", (index, row["id"])
        )


def get_owned_project(
    conn: sqlite3.Connection, project_id: str, user: sqlite3.Row
) -> sqlite3.Row:
    row = conn.execute(
        PROJECT_SELECT + " WHERE p.id = ?", (project_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if user["role"] != "admin" and row["owner_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
    return row


def get_deployment(
    conn: sqlite3.Connection, deployment_id: str, user: sqlite3.Row
) -> sqlite3.Row:
    row = conn.execute(
        DEPLOYMENT_SELECT + " WHERE d.id = ?", (deployment_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Deployment not found")
    if user["role"] != "admin" and row["owner_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return row


def deployment_logs(conn: sqlite3.Connection, deployment_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM deployment_logs WHERE deployment_id = ? ORDER BY ts ASC",
        (deployment_id,),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "ts": row["ts"],
            "level": row["level"],
            "step": row["step"],
            "message": row["message"],
        }
        for row in rows
    ]


def add_log(
    conn: sqlite3.Connection,
    deployment_id: str,
    step: str,
    message: str,
    level: str = "info",
) -> None:
    conn.execute(
        """INSERT INTO deployment_logs (id, deployment_id, ts, level, step, message)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (db.new_id("log"), deployment_id, db.iso(), level, step, message),
    )


def create_deployment(
    conn: sqlite3.Connection,
    *,
    project: sqlite3.Row,
    actor: sqlite3.Row,
    environment: str = "preview",
    commit_ref: Optional[str] = None,
) -> sqlite3.Row:
    """Queue a deployment. Never reports success without real infrastructure."""
    if project["status"] != "active":
        raise HTTPException(status_code=409, detail="Archived projects cannot be deployed")

    duplicate = conn.execute(
        "SELECT id FROM deployments WHERE project_id = ? AND status IN ('queued', 'building')",
        (project["id"],),
    ).fetchone()
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="This project already has a deployment waiting in the queue",
        )

    deployment_id = db.new_id("dep")
    now = db.utcnow()
    position = next_queue_position(conn)
    source_label = project["repo_url"] or project["zip_filename"] or project["name"]
    conn.execute(
        """INSERT INTO deployments (id, project_id, owner_id, status, environment, commit_ref,
              source_label, provider, provider_state, blocked_reason, preview_url,
              created_at, updated_at, expires_at, queue_position)
           VALUES (?, ?, ?, 'queued', ?, ?, ?, 'cloudflare', 'not_configured', ?, NULL, ?, ?, ?, ?)""",
        (
            deployment_id,
            project["id"],
            actor["id"],
            environment,
            commit_ref or ("HEAD" if project["source_type"] == "github" else None),
            source_label,
            config.DEPLOY_BLOCKED_REASON,
            db.iso(now),
            db.iso(now),
            db.iso(now + timedelta(hours=config.PREVIEW_TTL_HOURS)),
            position,
        ),
    )

    add_log(
        conn,
        deployment_id,
        "submission",
        f"Submission received for {project['name']} ({project['source_type']} source).",
    )
    add_log(
        conn,
        deployment_id,
        "validation",
        "Source reference validated: "
        + (
            f"GitHub repository {project['repo_url']} on branch {project['repo_branch'] or 'main'}."
            if project["source_type"] == "github"
            else f"ZIP archive {project['zip_filename']} with {project['archive_entries']} files."
        ),
    )
    add_log(
        conn,
        deployment_id,
        "queue",
        f"Queued at position {position}. Preview will expire {config.PREVIEW_TTL_HOURS} hours after a successful build.",
    )
    add_log(
        conn,
        deployment_id,
        "provider",
        "Build provider not connected. Cloudflare integration arrives in a later phase, so no "
        "build has been executed and no live URL exists yet.",
        level="warn",
    )

    notify(
        conn,
        user_id=actor["id"],
        kind="deployment",
        title="Deployment queued",
        body=f"{project['name']} is queued at position {position}. Build infrastructure is pending Cloudflare integration.",
        link=f"/app/deployments/{deployment_id}",
    )
    record_activity(
        conn,
        actor=actor,
        action="deployment.queued",
        target_type="deployment",
        target_id=deployment_id,
        detail=f"{project['name']} queued at position {position}",
    )
    return get_deployment(conn, deployment_id, actor)


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
