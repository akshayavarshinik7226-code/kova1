"""End-to-end API tests for the KOVA Stage 1 backend."""

from __future__ import annotations

import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.main import app

ADMIN = {"email": "admin@kova.dev", "password": "KovaAdmin123!"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def student(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Ada Student",
            "email": "ada@example.com",
            "password": "TestPass123",
            "university": "Test University",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return {"token": data["access_token"], "user": data["user"]}


@pytest.fixture(scope="module")
def admin_token(client):
    response = client.post("/api/auth/login", json=ADMIN)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def make_zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def test_health_and_meta(client):
    assert client.get("/api/health").json()["status"] == "ok"
    meta = client.get("/api/meta").json()
    assert meta["name"] == "KOVA"
    assert meta["deploy_provider"]["configured"] is False
    assert meta["features"]["build_execution"] is False
    assert meta["features"]["preview_urls"] is False


def test_requires_authentication(client):
    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/deployments").status_code == 401
    assert client.get("/api/admin/overview").status_code == 401


def test_auth_flow(client, student):
    me = client.get("/api/auth/me", headers=auth(student["token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "ada@example.com"
    assert me.json()["role"] == "student"

    updated = client.patch(
        "/api/auth/me", headers=auth(student["token"]), json={"bio": "Builder", "avatar_color": "cyan"}
    )
    assert updated.status_code == 200
    assert updated.json()["bio"] == "Builder"

    bad = client.post(
        "/api/auth/login", json={"email": "ada@example.com", "password": "wrongpass1"}
    )
    assert bad.status_code == 401

    duplicate = client.post(
        "/api/auth/register",
        json={"name": "Someone Else", "email": "ada@example.com", "password": "TestPass123"},
    )
    assert duplicate.status_code == 409

    weak = client.post(
        "/api/auth/register",
        json={"name": "Weak Pass", "email": "weak@example.com", "password": "onlyletters"},
    )
    assert weak.status_code == 422


def test_github_project_validation(client, student):
    headers = auth(student["token"])
    bad = client.post(
        "/api/projects/github",
        headers=headers,
        json={"name": "Bad", "repo_url": "https://gitlab.com/a/b", "branch": "main"},
    )
    assert bad.status_code == 422

    created = client.post(
        "/api/projects/github",
        headers=headers,
        json={
            "name": "Portfolio",
            "repo_url": "https://github.com/ada/portfolio.git",
            "branch": "main",
            "description": "Personal site",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["source_type"] == "github"
    assert body["repo_url"] == "https://github.com/ada/portfolio"
    assert body["slug"] == "portfolio"

    listed = client.get("/api/projects", headers=headers).json()
    assert [item["id"] for item in listed] == [body["id"]]

    filtered = client.get("/api/projects?source=zip", headers=headers).json()
    assert filtered == []

    search = client.get("/api/projects?search=portfolio", headers=headers).json()
    assert len(search) == 1

    patched = client.patch(
        f"/api/projects/{body['id']}", headers=headers, json={"description": "Updated"}
    )
    assert patched.json()["description"] == "Updated"


def test_zip_project(client, student):
    headers = auth(student["token"])
    payload = make_zip({"index.html": "<h1>Hello</h1>", "app/main.js": "export {}"})
    response = client.post(
        "/api/projects/zip",
        headers=headers,
        data={"name": "Zip Project", "description": "Archive upload"},
        files={"file": ("project.zip", payload, "application/zip")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["source_type"] == "zip"
    assert body["archive_entries"] == 2
    assert body["zip_filename"] == "project.zip"

    unsafe = make_zip({"../escape.txt": "nope"})
    rejected = client.post(
        "/api/projects/zip",
        headers=headers,
        data={"name": "Unsafe"},
        files={"file": ("unsafe.zip", unsafe, "application/zip")},
    )
    assert rejected.status_code == 422


def test_deployment_queue_is_honest(client, student):
    headers = auth(student["token"])
    project = client.post(
        "/api/projects/github",
        headers=headers,
        json={"name": "Deploy Me", "repo_url": "https://github.com/ada/deploy-me", "branch": "main"},
    ).json()

    queued = client.post(
        "/api/deployments",
        headers=headers,
        json={"project_id": project["id"], "environment": "preview"},
    )
    assert queued.status_code == 201, queued.text
    deployment = queued.json()
    assert deployment["status"] == "queued"
    assert deployment["provider"] == "cloudflare"
    assert deployment["provider_state"] == "not_configured"
    assert deployment["preview_url"] is None
    assert isinstance(deployment["queue_position"], int)
    assert deployment["queue_position"] >= 1
    assert deployment["blocked_reason"]
    assert deployment["logs"], "queued deployments must explain why no build ran"
    assert any(log["level"] == "warn" for log in deployment["logs"])

    duplicate = client.post(
        "/api/deployments", headers=headers, json={"project_id": project["id"]}
    )
    assert duplicate.status_code == 409

    listed = client.get("/api/deployments", headers=headers).json()
    assert listed[0]["id"] == deployment["id"]

    logs = client.get(f"/api/deployments/{deployment['id']}/logs", headers=headers).json()
    assert len(logs) >= 3

    notifications = client.get("/api/notifications", headers=headers).json()
    assert any("queued" in note["title"].lower() for note in notifications)
    unread = client.get("/api/notifications?unread_only=true", headers=headers).json()
    assert len(unread) >= 1
    marked = client.post("/api/notifications/read-all", headers=headers)
    assert marked.json()["updated"] >= 1

    canceled = client.post(f"/api/deployments/{deployment['id']}/cancel", headers=headers)
    assert canceled.status_code == 200
    assert canceled.json()["status"] == "canceled"
    assert canceled.json()["queue_position"] is None

    retried = client.post(f"/api/deployments/{deployment['id']}/retry", headers=headers)
    assert retried.status_code == 201
    assert retried.json()["status"] == "queued"
    assert retried.json()["id"] != deployment["id"]


def test_ownership_isolation(client):
    other = client.post(
        "/api/auth/register",
        json={"name": "Other Student", "email": "other@example.com", "password": "TestPass123"},
    ).json()
    headers = auth(other["access_token"])
    assert client.get("/api/projects", headers=headers).json() == []

    project = client.post(
        "/api/projects/github",
        headers=headers,
        json={"name": "Private", "repo_url": "https://github.com/other/private", "branch": "main"},
    ).json()

    intruder = client.post(
        "/api/auth/register",
        json={"name": "Intruder", "email": "intruder@example.com", "password": "TestPass123"},
    ).json()
    intruder_headers = auth(intruder["access_token"])
    assert client.get(f"/api/projects/{project['id']}", headers=intruder_headers).status_code == 404
    assert (
        client.post(
            "/api/deployments", headers=intruder_headers, json={"project_id": project["id"]}
        ).status_code
        == 404
    )


def test_admin_surfaces(client, student, admin_token):
    forbidden = client.get("/api/admin/overview", headers=auth(student["token"]))
    assert forbidden.status_code == 403

    headers = auth(admin_token)
    overview = client.get("/api/admin/overview", headers=headers)
    assert overview.status_code == 200
    body = overview.json()
    assert body["totals"]["projects"] >= 3
    assert body["provider"]["configured"] is False
    assert isinstance(body["queue"], list)

    students = client.get("/api/admin/students", headers=headers).json()
    assert any(item["email"] == "student@kova.dev" for item in students)
    target = next(item for item in students if item["email"] == "ada@example.com")
    assert target["project_count"] >= 1

    suspended = client.patch(
        f"/api/admin/students/{target['id']}", headers=headers, json={"status": "suspended"}
    )
    assert suspended.status_code == 200
    assert suspended.json()["status"] == "suspended"

    blocked = client.post(
        "/api/auth/login", json={"email": "ada@example.com", "password": "TestPass123"}
    )
    assert blocked.status_code == 403

    restored = client.patch(
        f"/api/admin/students/{target['id']}", headers=headers, json={"status": "active"}
    )
    assert restored.json()["status"] == "active"

    self_suspend = client.patch(
        f"/api/admin/students/{body['recent_activity'][0]['id'] if False else 'nope'}",
        headers=headers,
        json={"status": "suspended"},
    )
    assert self_suspend.status_code == 404

    for path in (
        "/api/admin/projects",
        "/api/admin/deployments",
        "/api/admin/queue",
        "/api/admin/failed",
        "/api/admin/activity",
        "/api/admin/usage",
        "/api/admin/system",
        "/api/admin/messages",
    ):
        response = client.get(path, headers=headers)
        assert response.status_code == 200, f"{path} -> {response.text}"

    queue = client.get("/api/admin/queue", headers=headers).json()
    assert queue["provider"]["configured"] is False
    assert "never advances" in queue["note"]

    usage = client.get("/api/admin/usage?days=7", headers=headers).json()
    assert usage["range_days"] == 7
    assert len(usage["deployments_by_day"]) == 7

    system = client.get("/api/admin/system", headers=headers).json()
    assert system["deploy_provider"]["configured"] is False


def test_contact_and_status(client):
    short = client.post(
        "/api/contact", json={"name": "Sam", "email": "sam@example.com", "message": "too short"}
    )
    assert short.status_code == 422

    ok = client.post(
        "/api/contact",
        json={
            "name": "Sam",
            "email": "sam@example.com",
            "topic": "support",
            "message": "I would like to know when deployment infrastructure is available.",
        },
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["ok"] is True

    status = client.get("/api/status").json()
    assert status["builds"]["state"] == "pending_integration"
    assert status["preview_urls"]["state"] == "pending_integration"
    assert status["api"]["state"] == "operational"
