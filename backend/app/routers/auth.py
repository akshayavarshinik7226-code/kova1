"""Authentication and account routes."""

from __future__ import annotations

import sqlite3
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..schemas import (
    LoginRequest,
    PasswordChange,
    ProfileUpdate,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)
from ..security import create_access_token, hash_password, token_ttl_seconds, verify_password
from ..services import get_current_user, get_db, public_user, record_activity

router = APIRouter(prefix="/auth", tags=["auth"])

# Very small in-process throttle to slow down credential stuffing on a single
# instance. A distributed limiter belongs with the future infrastructure work.
_FAILED_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_WINDOW_SECONDS = 15 * 60
_MAX_ATTEMPTS = 8


def _client_key(email: str) -> str:
    return email.strip().lower()


def _check_throttle(key: str) -> None:
    now = time.time()
    attempts = [stamp for stamp in _FAILED_ATTEMPTS[key] if now - stamp < _WINDOW_SECONDS]
    _FAILED_ATTEMPTS[key] = attempts
    if len(attempts) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed sign-in attempts. Try again in a few minutes.",
        )


def _register_failure(key: str) -> None:
    _FAILED_ATTEMPTS[key].append(time.time())


def _token_response(user: sqlite3.Row) -> dict:
    return {
        "access_token": create_access_token(user["id"], user["role"]),
        "token_type": "bearer",
        "expires_in": token_ttl_seconds(),
        "user": public_user(user),
    }


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, conn: sqlite3.Connection = Depends(get_db)):
    email = payload.email.lower()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = db.new_id("usr")
    colors = ["violet", "cyan", "emerald", "amber", "rose"]
    color = colors[sum(ord(ch) for ch in email) % len(colors)]
    conn.execute(
        """INSERT INTO users (id, email, name, password_hash, role, status, university,
              avatar_color, created_at)
           VALUES (?, ?, ?, ?, 'student', 'active', ?, ?, ?)""",
        (
            user_id,
            email,
            payload.name,
            hash_password(payload.password),
            payload.university or None,
            color,
            db.iso(),
        ),
    )
    conn.execute(
        """INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
           VALUES (?, ?, 'product', ?, ?, ?, 0, ?)""",
        (
            db.new_id("ntf"),
            user_id,
            "Welcome to KOVA",
            "Submit a GitHub repository or ZIP archive to join the deployment queue.",
            "/app/new-deployment",
            db.iso(),
        ),
    )
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    record_activity(
        conn,
        actor=user,
        action="account.registered",
        target_type="user",
        target_id=user_id,
        detail=f"{user['name']} created a student account",
    )
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, conn: sqlite3.Connection = Depends(get_db)):
    email = payload.email.lower()
    key = _client_key(email)
    _check_throttle(key)

    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if user is None or not verify_password(payload.password, user["password_hash"]):
        _register_failure(key)
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user["status"] == "suspended":
        raise HTTPException(
            status_code=403, detail="This account is suspended. Contact platform support."
        )

    now = db.iso()
    conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now, user["id"]))
    _FAILED_ATTEMPTS.pop(key, None)
    record_activity(
        conn,
        actor=user,
        action="account.signed_in",
        target_type="user",
        target_id=user["id"],
        detail=f"{user['name']} signed in",
    )
    refreshed = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return _token_response(refreshed)


@router.get("/me", response_model=UserPublic)
def me(user: sqlite3.Row = Depends(get_current_user)):
    return public_user(user)


@router.patch("/me", response_model=UserPublic)
def update_profile(
    payload: ProfileUpdate,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    updates: dict[str, object] = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.university is not None:
        updates["university"] = payload.university.strip() or None
    if payload.bio is not None:
        updates["bio"] = payload.bio.strip() or None
    if payload.notify_deployments is not None:
        updates["notify_deployments"] = int(payload.notify_deployments)
    if payload.notify_product is not None:
        updates["notify_product"] = int(payload.notify_product)
    if payload.avatar_color is not None:
        allowed = {"violet", "cyan", "emerald", "amber", "rose"}
        if payload.avatar_color not in allowed:
            raise HTTPException(status_code=422, detail="Unsupported avatar colour")
        updates["avatar_color"] = payload.avatar_color

    if updates:
        assignments = ", ".join(f"{column} = ?" for column in updates)
        conn.execute(
            f"UPDATE users SET {assignments} WHERE id = ?",
            (*updates.values(), user["id"]),
        )
        record_activity(
            conn,
            actor=user,
            action="account.profile_updated",
            target_type="user",
            target_id=user["id"],
            detail="Profile settings updated",
        )

    refreshed = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return public_user(refreshed)


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different")
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (hash_password(payload.new_password), user["id"]),
    )
    record_activity(
        conn,
        actor=user,
        action="account.password_changed",
        target_type="user",
        target_id=user["id"],
        detail="Password updated",
    )
    return {"ok": True, "message": "Password updated"}
