# syntax=docker/dockerfile:1
# KOVA — Stage 1
# Single container: FastAPI serves both the JSON API and the built React SPA.

# ---------- Stage 1: build the React + TypeScript SPA ----------
FROM node:24.22.2-bookworm-slim AS frontend-build

WORKDIR /build

# Install dependencies from the lockfile only, so the image build is reproducible.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy only the SPA sources; local node_modules, dist and tsbuildinfo stay out.
COPY frontend/index.html frontend/vite.config.ts ./
COPY frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json ./
COPY frontend/src ./src
RUN npm run build


# ---------- Stage 2: Python runtime serving API + SPA ----------
FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=3000 \
    KOVA_DATA_DIR=/app/data \
    KOVA_FRONTEND_DIST=/app/frontend/dist \
    KOVA_SEED_DEMO_DATA=1

# Apply current distributor fixes in the same layer that refreshes the package
# lists, so a cached layer can never keep stale OS libraries.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# Unprivileged runtime account.
RUN groupadd --system --gid 1001 kova \
    && useradd --system --uid 1001 --gid kova --home-dir /app --shell /usr/sbin/nologin kova

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r backend/requirements.txt

COPY backend/app ./backend/app
COPY --from=frontend-build /build/dist ./frontend/dist

# SQLite database, uploads and the generated JWT signing secret live here.
RUN mkdir -p /app/data/uploads \
    && chown -R kova:kova /app

USER kova

WORKDIR /app/backend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import os,sys,urllib.request;\nsys.exit(0 if urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','3000')+'/api/health', timeout=4).status == 200 else 1)"]

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
