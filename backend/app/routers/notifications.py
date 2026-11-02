"""In-app notification routes."""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query

from ..schemas import NotificationOut
from ..services import get_current_user, get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _payload(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "type": row["type"],
        "title": row["title"],
        "body": row["body"],
        "link": row["link"],
        "is_read": bool(row["is_read"]),
        "created_at": row["created_at"],
    }


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=200),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    query = "SELECT * FROM notifications WHERE user_id = ?"
    params: list[object] = [user["id"]]
    if unread_only:
        query += " AND is_read = 0"
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    return [_payload(row) for row in rows]


@router.post("/read-all")
def mark_all_read(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    cursor = conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", (user["id"],)
    )
    return {"ok": True, "updated": cursor.rowcount}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    row = conn.execute(
        "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
        (notification_id, user["id"]),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notification_id,))
    refreshed = conn.execute(
        "SELECT * FROM notifications WHERE id = ?", (notification_id,)
    ).fetchone()
    return _payload(refreshed)


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    cursor = conn.execute(
        "DELETE FROM notifications WHERE id = ? AND user_id = ?", (notification_id, user["id"])
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}
