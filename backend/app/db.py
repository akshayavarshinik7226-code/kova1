"""SQLite persistence layer for KOVA.

A small hand-written data layer keeps the dependency surface minimal while
remaining transactional and safe (parameterised queries only).
"""

from __future__ import annotations

import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

from . import config
from .security import hash_password

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    status TEXT NOT NULL DEFAULT 'active',
    university TEXT,
    bio TEXT,
    avatar_color TEXT NOT NULL DEFAULT 'violet',
    notify_deployments INTEGER NOT NULL DEFAULT 1,
    notify_product INTEGER NOT NULL DEFAULT 1,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL,
    repo_url TEXT,
    repo_branch TEXT,
    framework TEXT,
    zip_filename TEXT,
    archive_entries INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_owner_slug ON projects(owner_id, slug);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'preview',
    commit_ref TEXT,
    source_label TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'cloudflare',
    provider_state TEXT NOT NULL DEFAULT 'not_configured',
    blocked_reason TEXT,
    preview_url TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT,
    queue_position INTEGER
);
CREATE INDEX IF NOT EXISTS idx_deployments_project ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_owner ON deployments(owner_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);

CREATE TABLE IF NOT EXISTS deployment_logs (
    id TEXT PRIMARY KEY,
    deployment_id TEXT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    ts TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    step TEXT NOT NULL,
    message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_deployment ON deployment_logs(deployment_id, ts);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS activity_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_name TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT 'general',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
);
"""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime | None = None) -> str:
    return (moment or utcnow()).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(str(config.DB_PATH), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    Path(config.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
    if config.SEED_DEMO_DATA:
        seed_demo_data()


# --- seeding -----------------------------------------------------------------

DEMO_COLORS = ["violet", "cyan", "emerald", "amber", "rose"]


def _seed_user(
    conn: sqlite3.Connection,
    *,
    email: str,
    name: str,
    password: str,
    role: str,
    university: str,
    bio: str,
    is_demo: bool,
    created_days_ago: int,
    color: str,
) -> str:
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        return existing["id"]
    user_id = new_id("usr")
    created = utcnow() - timedelta(days=created_days_ago)
    conn.execute(
        """INSERT INTO users (id, email, name, password_hash, role, status, university,
              bio, avatar_color, is_demo, created_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)""",
        (
            user_id,
            email,
            name,
            hash_password(password),
            role,
            university,
            bio,
            color,
            int(is_demo),
            iso(created),
        ),
    )
    return user_id


def seed_demo_data() -> None:
    """Create clearly-labelled demo accounts so the UI is explorable.

    Demo rows carry is_demo = 1 and the interface marks them as DEMO DATA.
    Demo deployments are queued only — never reported as successful.
    """
    with connect() as conn:
        student_id = _seed_user(
            conn,
            email="student@kova.dev",
            name="Aarav Mehta",
            password="KovaDemo123!",
            role="student",
            university="Northfield Institute of Technology",
            bio="Final-year CS student building small tools for campus communities.",
            is_demo=True,
            created_days_ago=38,
            color="violet",
        )
        _seed_user(
            conn,
            email="admin@kova.dev",
            name="KOVA Admin",
            password="KovaAdmin123!",
            role="admin",
            university="KOVA Platform",
            bio="Platform operations account.",
            is_demo=True,
            created_days_ago=90,
            color="cyan",
        )

        demo_projects = [
            {
                "name": "campus-hub",
                "description": "Event discovery board for campus societies, built with React and Vite.",
                "source_type": "github",
                "repo_url": "https://github.com/kova-demo/campus-hub",
                "repo_branch": "main",
                "framework": "Vite + React",
                "days": 26,
            },
            {
                "name": "study-planner",
                "description": "Deadline tracker with offline-first storage for exam season.",
                "source_type": "zip",
                "zip_filename": "study-planner.zip",
                "archive_entries": 42,
                "framework": "Static HTML/CSS/JS",
                "days": 14,
            },
            {
                "name": "ml-notebook-suite",
                "description": "Streamlit dashboards for an introductory machine learning course.",
                "source_type": "github",
                "repo_url": "https://github.com/kova-demo/ml-notebook-suite",
                "repo_branch": "main",
                "framework": "Python / Streamlit",
                "days": 5,
            },
        ]

        for index, project in enumerate(demo_projects):
            slug = project["name"]
            found = conn.execute(
                "SELECT id FROM projects WHERE owner_id = ? AND slug = ?",
                (student_id, slug),
            ).fetchone()
            if found:
                continue
            project_id = new_id("prj")
            created = utcnow() - timedelta(days=project["days"])
            conn.execute(
                """INSERT INTO projects (id, owner_id, name, slug, description, source_type,
                      repo_url, repo_branch, framework, zip_filename, archive_entries,
                      status, is_demo, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)""",
                (
                    project_id,
                    student_id,
                    slug,
                    slug,
                    project["description"],
                    project["source_type"],
                    project.get("repo_url"),
                    project.get("repo_branch"),
                    project["framework"],
                    project.get("zip_filename"),
                    project.get("archive_entries", 0),
                    iso(created),
                    iso(created),
                ),
            )
            dep_created = created + timedelta(hours=3 + index)
            deployment_id = new_id("dep")
            status = "queued" if index != 1 else "canceled"
            conn.execute(
                """INSERT INTO deployments (id, project_id, owner_id, status, environment,
                      commit_ref, source_label, provider, provider_state, blocked_reason,
                      preview_url, created_at, updated_at, expires_at, queue_position)
                   VALUES (?, ?, ?, ?, 'preview', ?, ?, 'cloudflare', 'not_configured', ?,
                      NULL, ?, ?, ?, ?)""",
                (
                    deployment_id,
                    project_id,
                    student_id,
                    status,
                    "HEAD" if project["source_type"] == "github" else None,
                    project.get("repo_url") or project.get("zip_filename"),
                    config.DEPLOY_BLOCKED_REASON,
                    iso(dep_created),
                    iso(dep_created),
                    iso(dep_created + timedelta(hours=config.PREVIEW_TTL_HOURS)),
                    index + 1 if status == "queued" else None,
                ),
            )
            conn.execute(
                """INSERT INTO deployment_logs (id, deployment_id, ts, level, step, message)
                   VALUES (?, ?, ?, 'info', 'validation', ?)""",
                (
                    new_id("log"),
                    deployment_id,
                    iso(dep_created),
                    "Demo record: submission validated against the KOVA validation rules.",
                ),
            )
            conn.execute(
                """INSERT INTO deployment_logs (id, deployment_id, ts, level, step, message)
                   VALUES (?, ?, ?, 'warn', 'queue', ?)""",
                (
                    new_id("log"),
                    deployment_id,
                    iso(dep_created + timedelta(seconds=20)),
                    "Waiting for build infrastructure. Cloudflare integration is not connected in Stage 1.",
                ),
            )

        conn.execute(
            """INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
               VALUES (?, ?, 'system', ?, ?, ?, 0, ?)""",
            (
                new_id("ntf"),
                student_id,
                "Welcome to the KOVA demo workspace",
                "This account contains DEMO DATA. Deployments stay queued until Cloudflare integration lands.",
                "/app/overview",
                iso(utcnow() - timedelta(days=2)),
            ),
        )
        existing_events = conn.execute("SELECT COUNT(*) AS c FROM activity_events").fetchone()
        if existing_events and existing_events["c"] == 0:
            conn.execute(
                """INSERT INTO activity_events (id, actor_id, actor_name, action, target_type,
                      target_id, detail, created_at)
                   VALUES (?, NULL, 'system', 'demo.seeded', 'workspace', NULL,
                      'Demo workspace initialised with labelled sample data.', ?)""",
                (new_id("evt"), iso(utcnow())),
            )
