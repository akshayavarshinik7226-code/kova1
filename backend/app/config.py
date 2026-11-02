"""Runtime configuration for the KOVA API.

All values are read from the environment so no secret is ever committed to the
repository. Sensible development defaults are used when a value is absent.
"""

from __future__ import annotations

import hashlib
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent


def _resolve_data_dir() -> Path:
    raw = os.getenv("KOVA_DATA_DIR") or str(BASE_DIR / "data")
    path = Path(raw).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


DATA_DIR = _resolve_data_dir()
DB_PATH = Path(os.getenv("KOVA_DB_PATH") or (DATA_DIR / "kova.db"))
UPLOAD_DIR = Path(os.getenv("KOVA_UPLOAD_DIR") or (DATA_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

APP_NAME = "KOVA"
APP_VERSION = "1.0.0-stage1"
API_PREFIX = "/api"

# Preview deployments are designed to expire after 24 hours.
PREVIEW_TTL_HOURS = int(os.getenv("KOVA_PREVIEW_TTL_HOURS", "24"))

# Cloudflare Pages/Workers integration is deliberately not configured in
# Stage 1. The API reports this state honestly instead of simulating builds.
DEPLOY_PROVIDER = "cloudflare"
DEPLOY_PROVIDER_CONFIGURED = False
DEPLOY_PROVIDER_LABEL = "Cloudflare (pending integration)"
DEPLOY_BLOCKED_REASON = (
    "Build and deployment infrastructure is not connected yet. "
    "Cloudflare integration is scheduled for the next development phase."
)

MAX_UPLOAD_BYTES = int(os.getenv("KOVA_MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "KOVA_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

FRONTEND_DIST = Path(os.getenv("KOVA_FRONTEND_DIST") or (REPO_ROOT / "frontend" / "dist"))

# Seeding demo content keeps the UI explorable on a fresh install. Every seeded
# row is flagged is_demo and labelled "DEMO" in the interface.
SEED_DEMO_DATA = os.getenv("KOVA_SEED_DEMO_DATA", "1") not in {"0", "false", "False"}


def get_secret_key() -> str:
    """Return the JWT signing key, persisting a random one for dev installs."""
    env_secret = os.getenv("KOVA_SECRET_KEY")
    if env_secret:
        # HS256 signs with SHA-256, whose RFC 7518 minimum key length is 32 bytes.
        # Short operator-provided secrets are hashed to a stable 64-character key
        # instead of being rejected, so sessions survive a restart.
        if len(env_secret.encode("utf-8")) >= 32:
            return env_secret
        return hashlib.sha256(env_secret.encode("utf-8")).hexdigest()

    secret_file = DATA_DIR / "secret.key"
    if secret_file.exists():
        stored = secret_file.read_text(encoding="utf-8").strip()
        if stored:
            return stored

    generated = secrets.token_urlsafe(48)
    secret_file.write_text(generated, encoding="utf-8")
    try:
        secret_file.chmod(0o600)
    except OSError:  # pragma: no cover - filesystem dependent
        pass
    return generated
