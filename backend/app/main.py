"""KOVA FastAPI application entrypoint.

Serves the JSON API under /api and (in production builds) the compiled React
single-page application from frontend/dist with a history fallback.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from . import config, db
from .routers import admin, auth, deployments, notifications, projects, public

logger = logging.getLogger("kova")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    logger.info("KOVA %s ready · data=%s", config.APP_VERSION, config.DATA_DIR)
    yield


app = FastAPI(
    title="KOVA API",
    version=config.APP_VERSION,
    description=(
        "Student project deployment platform API. Stage 1 exposes authentication, "
        "project submission, a deployment queue and administrator controls. Build "
        "execution is pending the Cloudflare integration and is never simulated."
    ),
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, projects, deployments, notifications, admin, public):
    app.include_router(module.router, prefix=config.API_PREFIX)

DIST_DIR = config.FRONTEND_DIST


@app.get("/api", include_in_schema=False)
def api_root():
    return {
        "name": config.APP_NAME,
        "version": config.APP_VERSION,
        "docs": "/api/docs",
        "health": "/api/health",
    }


def _dist_ready() -> bool:
    return (DIST_DIR / "index.html").is_file()


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str):
    """Serve static assets and fall back to index.html for client-side routes."""
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    if _dist_ready():
        candidate = (DIST_DIR / full_path).resolve()
        try:
            candidate.relative_to(DIST_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=404, detail="Not found") from None
        if full_path and candidate.is_file():
            immutable = full_path.startswith("assets/")
            headers = (
                {"Cache-Control": "public, max-age=31536000, immutable"} if immutable else None
            )
            return FileResponse(candidate, headers=headers)
        return FileResponse(
            DIST_DIR / "index.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )

    return JSONResponse(
        status_code=200,
        content={
            "name": config.APP_NAME,
            "version": config.APP_VERSION,
            "status": "api_only",
            "message": (
                "The KOVA API is running. The frontend bundle was not found at "
                f"{DIST_DIR}. Build the frontend (npm run build) or run the Vite dev server."
            ),
            "api": "/api",
            "docs": "/api/docs",
        },
    )
