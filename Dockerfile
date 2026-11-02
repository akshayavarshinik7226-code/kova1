# syntax=docker/dockerfile:1
# KOVA — Stage 1
# Single container, single public port. `node` is the container entrypoint
# (server/gateway.mjs): it serves the built React SPA and proxies /api/* to the
# FastAPI backend that it supervises on loopback.

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


# ---------- Stage 2: runtime — Node gateway + FastAPI ----------
FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    KOVA_DATA_DIR=/app/data \
    KOVA_FRONTEND_DIST=/app/frontend/dist \
    KOVA_BACKEND_DIR=/app/backend \
    KOVA_API_PORT=8000 \
    KOVA_PYTHON=python3 \
    KOVA_SEED_DEMO_DATA=1

# Apply current distributor fixes in the same layer that refreshes the package
# lists, so a cached layer can never keep stale OS libraries. libstdc++6 is the
# Node binary's only non-base runtime dependency.
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Node runtime for the gateway, taken from the official Node image so the
# glibc/libstdc++ ABI matches the Debian release used here.
COPY --from=frontend-build /usr/local/bin/node /usr/local/bin/node

# Unprivileged runtime account.
RUN groupadd --system --gid 1001 kova \
    && useradd --system --uid 1001 --gid kova --home-dir /app --shell /usr/sbin/nologin kova

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r backend/requirements.txt

COPY backend/app ./backend/app
COPY server ./server
COPY --from=frontend-build /build/dist ./frontend/dist

# SQLite database, uploads and the generated JWT signing secret live here.
RUN mkdir -p /app/data/uploads \
    && chown -R kova:kova /app

USER kova

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||'3000')+'/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Node entrypoint: serves the SPA and proxies /api to FastAPI (spawned child).
CMD ["node", "/app/server/gateway.mjs"]
