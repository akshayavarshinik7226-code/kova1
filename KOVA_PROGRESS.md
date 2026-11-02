# KOVA — Project Checkpoint

**Branch:** `appjet`
**Checkpoint purpose:** freeze the current working state of the KOVA platform (Stage 1 UI/UX + API) before further development continues.
**Language of the product UI:** English
**Status:** Stage 1 feature-complete for the public site, student dashboard and admin dashboard, verified by a clean TypeScript build and a passing backend test suite. Real deployment execution (Cloudflare) is **not** integrated and is clearly labelled as pending in the UI.

---

## 1. What KOVA is

KOVA is a student project deployment platform. A student submits a project as a **GitHub repository URL** or a **ZIP upload**, KOVA validates the submission, queues a deployment, and — once the deployment provider is integrated — returns a live URL. Preview deployments are intended to expire after 24 hours.

**Current reality (important):**

- Validation, queueing, cancellation, retry, notifications, admin review and audit logging are real and backed by the API.
- **Builds and hosting are not executed.** `POST /api/deployments` creates a deployment with `status="queued"`, `provider="cloudflare"`, `provider_state="not_configured"` and `preview_url=null`. The UI states "Cloudflare integration pending" wherever a live URL or build artefact would appear.
- No fake success states, fake live URLs, or invented real-time metrics exist anywhere in the product.
- Seeded rows carry an `is_demo` flag and are labelled **DEMO DATA** in the interface.

---

## 2. Repository origin note

The GitHub repository contained only a 7-byte `README.md` (`# kova1`) on both `appjet` and `main` when this work started. There was no prior React/FastAPI code to extend, so KOVA was implemented from scratch **in the requested stack** (React + TypeScript SPA, FastAPI backend). Nothing was deleted: the original `README.md` is preserved unchanged.

---

## 3. Stack and architecture

```
kova1/
├── README.md                  # original repository file (unchanged)
├── KOVA_PROGRESS.md           # this checkpoint document
├── backend/                   # FastAPI + SQLite API
│   ├── app/
│   │   ├── config.py          # env-driven configuration, secret handling, paths
│   │   ├── db.py              # SQLite schema init, migrations-lite, demo seeding
│   │   ├── security.py        # password hashing, JWT issue/verify, current-user deps
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── services.py        # business logic: queue, audit events, notifications, stats
│   │   ├── main.py            # app factory, routers, SPA static serving + fallback
│   │   └── routers/
│   │       ├── auth.py        # register, login, me, profile update, password change
│   │       ├── projects.py    # list/create (GitHub + ZIP)/read/update/delete
│   │       ├── deployments.py # list/create/read/logs/cancel/retry
│   │       ├── notifications.py
│   │       ├── admin.py       # overview, students, projects, deployments, queue,
│   │       │                  # failed, activity, usage, system, contact messages
│   │       └── public.py      # meta, health, status, contact
│   ├── tests/                 # pytest suite (conftest + test_api, 9 tests)
│   ├── pytest.ini
│   ├── requirements.txt       # runtime deps (pinned)
│   └── requirements-dev.txt   # test-only deps
└── frontend/                  # React 18 + TypeScript + Vite SPA
    ├── index.html
    ├── vite.config.ts         # dev proxy /api -> 127.0.0.1:8000
    ├── tsconfig*.json
    └── src/
        ├── main.tsx
        ├── App.tsx            # providers + full route table + Guard/NotFound
        ├── components/        # Icon, ui primitives, PublicLayout, AppLayout, DocsContent
        ├── context/           # AuthContext, ThemeContext, ToastContext
        ├── lib/               # api client, useAsync hook, formatters
        ├── styles/global.css  # design tokens, dark/light themes, layout, animation
        └── pages/
            ├── public/        # 8 public pages
            ├── app/           # 10 student pages
            └── admin/         # 10 admin pages
```

### Backend

- **FastAPI 0.115.6**, served by **uvicorn 0.34.0**; API mounted under `/api`; OpenAPI at `/api/docs`.
- **SQLite** (stdlib `sqlite3`, no ORM), database file at `backend/data/kova.db` by default (git-ignored).
- Tables: `users`, `projects`, `deployments`, `deployment_logs`, `notifications`, `activity_events`, `contact_messages`.
- **Auth:** email + password (PBKDF2 hash via `security.py`), stateless **JWT (HS256, PyJWT)** bearer tokens; role-based access (`student` / `admin`) enforced by dependencies.
- **Secret key:** `KOVA_SECRET_KEY` env var; if absent or shorter than 32 bytes, a stable 64-char SHA-256-derived key is used so HMAC-SHA256 always meets the RFC 7518 minimum. Development installs persist a generated key to `backend/data/secret.key` (never committed).
- **ZIP uploads:** `python-multipart`, size-capped (`KOVA_MAX_UPLOAD_BYTES`, default 25 MB), archive contents inspected/validated, no code from uploads is executed.
- **Frontend serving:** `main.py` serves `frontend/dist` when present and falls back to `index.html` for client-side routes; if the bundle is missing the API still answers with a JSON explanation at `/`.

### Frontend

- **React 18.3**, **TypeScript 5.6**, **Vite 6**, **react-router-dom 7.18.5** (no other runtime dependencies).
- Dark theme is the default; the light/dark toggle is persisted in `localStorage` and applied before paint.
- Reusable primitives in `components/ui.tsx`: buttons, cards, tables, badges, status pills, empty/loading/error states, form fields, page headers, tabs, skeletons, modals.
- Data fetching through `lib/api.ts` (typed fetch wrapper with bearer token, error normalization) and `lib/useAsync.ts` (loading / error / refetch).
- Toast notifications (`ToastContext`) for every mutation; inline validation errors on all forms.

### Routes

**Public**

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/features` | Features |
| `/how-it-works` | How It Works |
| `/docs` | Documentation |
| `/faq` | FAQ |
| `/contact` | Contact / support |
| `/login` | Login |
| `/register` | Registration |

**Student** (guarded, requires auth)

| Path | Page |
| --- | --- |
| `/app` | Overview |
| `/app/projects` | My Projects |
| `/app/projects/:id` | Project detail |
| `/app/projects/:id/settings` | Project settings |
| `/app/deployments` | Deployments |
| `/app/deployments/new` | New deployment |
| `/app/deployments/:id` | Deployment detail |
| `/app/deployments/:id/logs` | Build logs |
| `/app/notifications` | Notifications |
| `/app/profile` | Profile settings |
| `/app/docs` | Documentation |

**Admin** (guarded, requires `admin` role)

| Path | Page |
| --- | --- |
| `/admin` | Overview + statistics |
| `/admin/students` | Student management |
| `/admin/projects` | Project management |
| `/admin/deployments` | Deployment management |
| `/admin/queue` | Deployment queue |
| `/admin/failed` | Failed deployments |
| `/admin/activity` | Activity log |
| `/admin/usage` | Usage statistics |
| `/admin/system` | System status |
| `/admin/messages` | Contact messages |

### API surface

| Prefix | Endpoints |
| --- | --- |
| `/api/public` (mounted at `/api`) | `GET /meta`, `GET /health`, `GET /status`, `POST /contact` |
| `/api/auth` | `POST /register`, `POST /login`, `GET /me`, `PATCH /me`, `POST /change-password` |
| `/api/projects` | `GET /`, `POST /github`, `POST /zip`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/api/deployments` | `GET /`, `POST /`, `GET /{id}`, `GET /{id}/logs`, `POST /{id}/cancel`, `POST /{id}/retry` |
| `/api/notifications` | `GET /`, `POST /read-all`, `POST /{id}/read`, `DELETE /{id}` |
| `/api/admin` | `GET /overview`, `/students`, `PATCH|DELETE /students/{id}`, `/projects`, `PATCH|DELETE /projects/{id}`, `/deployments`, `/queue`, `/failed`, `POST /deployments/{id}/cancel`, `/activity`, `/usage`, `/system`, `/messages`, `PATCH /messages/{id}` |

---

## 4. Completed work

### Backend

- [x] Configuration module with env overrides, data directories, CORS list, preview TTL, upload cap.
- [x] SQLite schema creation + idempotent startup, demo seeding toggle (`KOVA_SEED_DEMO_DATA`).
- [x] Password hashing, JWT issuance/verification, `current_user` and `require_admin` dependencies.
- [x] Registration, login, profile read/update, password change (with current-password check).
- [x] Project creation from GitHub URL (URL/owner/repo/branch validation, duplicate detection) and from ZIP upload (type + size + archive validation).
- [x] Project read/update/delete with strict ownership isolation.
- [x] Deployment queue: create (queued only), list with filters, detail, logs endpoint, cancel, retry (creates a new queued attempt).
- [x] Notifications: list, mark one read, mark all read, delete.
- [x] Admin: platform overview, student list/role+suspension updates/deletion, project moderation, deployment listing, queue ordering, failed monitoring, cancellation, activity feed, usage stats, system status, contact message triage.
- [x] Public meta/health/status endpoints and contact form ingestion.
- [x] Audit events written for the mutations that matter (project created/deleted, deployment queued/cancelled/retried, admin actions).
- [x] SPA static serving with history fallback and cache headers.
- [x] pytest suite: 9 tests covering auth, GitHub project validation, ZIP project, deployment queue honesty (queued + no preview URL), ownership isolation, admin surfaces.

### Frontend

- [x] Design system: tokens for colour/space/typography/radii/shadow, dark default + persisted light theme, subtle transitions, focus-visible states.
- [x] Shared primitives (buttons, cards, tables, badges, status pills, tabs, modal, skeletons, empty/error/loading states) reused across all pages — no duplicated page-local copies.
- [x] Public layout (sticky nav, mobile menu, footer) and authenticated layout (sidebar, topbar, notification badge, theme toggle, account menu, mobile drawer).
- [x] 8 public pages with consistent design, real content, working navigation and working forms.
- [x] 10 student pages wired to the API: overview stats, project cards/tables with search, project detail and settings (rename, branch, delete with confirmation), deployment list with status filters, new deployment flow (GitHub/ZIP), deployment detail timeline with cancel/retry, build logs viewer with honest "provider not configured" explanation, notifications (read/all/delete), profile settings (name, password change).
- [x] 10 admin pages wired to the API: stats overview, students (role change, suspend), projects, deployments, queue with position, failed deployments, activity feed, usage breakdown, system status, contact messages (status triage).
- [x] Auth context with token persistence and guarded routes (`Guard` redirects unauthenticated users to `/login` and blocks non-admins from `/admin`).
- [x] "Cloudflare integration pending" badges wherever a live URL/build result would appear; DEMO DATA labels on seeded content.
- [x] Responsive layouts (collapsible sidebar/drawer, stacked tables/cards on small viewports).

### Quality fixes made during Stage 1 verification

- [x] TypeScript build errors fixed (`PageHead`/`SectionHead` prop types, `SectionHead` subtitle alias, unused `Button` import) — `tsc -b` is clean.
- [x] Hardened pinned backend dependencies: `python-multipart` 0.0.20 → 0.0.33, `PyJWT` 2.10.1 → 2.15.1.
- [x] `get_secret_key()` now derives a 64-char SHA-256 key when the configured secret is shorter than 32 bytes, removing PyJWT `InsecureKeyLengthWarning`s from the test suite.
- [x] `react-router-dom` upgraded 6.x → `^7.18.5`, clearing the two moderate advisories found by the dependency scan.

---

## 5. Pending work

1. **Deployment packaging** — there is no `Dockerfile` yet. Plan: Node 22 LTS (or 24 LTS) build stage to produce `frontend/dist`, then a Python 3.13 final stage running `uvicorn app.main:app --host 0.0.0.0`, with `apt-get update && apt-get upgrade` in one `RUN`, apt lists removed, and a non-root user. Then `check_deployment`, `deploy_app`, `wait_for_app_ready`.
2. **Browser/UI verification** — no browser interaction checks have been recorded yet. Planned flows: landing render, student login, GitHub project creation, queue a deployment (must stay `queued`, no preview URL), admin queue view, theme-toggle persistence, 390px mobile layout.
3. **Dependency security scan re-run** after the react-router 7 upgrade (the last recorded scan was revision 66 and predates it).
4. **Cloudflare deployment integration** — future phase, explicitly out of scope for Stage 1. Requires provider credentials, a build runner and an isolated execution environment; nothing in this repo executes user code.
5. **Optional polish** — pagination on large admin tables (currently client-side filtering), ZIP inspection reporting detail, per-project environment variable storage (deliberately deferred: storing user secrets needs real encryption and would otherwise create a security risk).

---

## 6. How to run

### Backend

```bash
cd backend
python3 -m pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API: <http://127.0.0.1:8000/api>
- Interactive docs: <http://127.0.0.1:8000/api/docs>

### Frontend (development)

```bash
cd frontend
npm ci          # or: npm install
npm run dev     # http://127.0.0.1:5173, proxies /api to :8000
```

### Frontend (production bundle served by FastAPI)

```bash
cd frontend && npm ci && npm run build   # emits frontend/dist
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

With `frontend/dist` present, the FastAPI app serves the SPA and its client-side routes.

### Tests and checks

```bash
cd backend && python3 -m pytest -q          # 9 tests
cd frontend && npm run build                # tsc -b && vite build
cd frontend && npm run typecheck            # types only
```

### Demo accounts (development seed data)

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@kova.dev` | `KovaDemo123!` |
| Admin | `admin@kova.dev` | `KovaAdmin123!` |

These are development seed credentials created by the seeder only when `KOVA_SEED_DEMO_DATA` is not `0`. They are not production credentials.

---

## 7. Environment variables

All optional; sensible development defaults are used when unset. **No secrets are committed and no `.env` file is tracked.**

| Variable | Default | Purpose |
| --- | --- | --- |
| `KOVA_SECRET_KEY` | derived / persisted dev key | JWT signing key. Values ≥ 32 bytes are used verbatim; shorter values are SHA-256 derived to a 64-char key. Set a strong random value in production. |
| `KOVA_DATA_DIR` | `backend/data` | Base directory for database, uploads, dev secret. |
| `KOVA_DB_PATH` | `$KOVA_DATA_DIR/kova.db` | SQLite database file. |
| `KOVA_UPLOAD_DIR` | `$KOVA_DATA_DIR/uploads` | Stored ZIP uploads. |
| `KOVA_FRONTEND_DIST` | `frontend/dist` | Location of the built SPA bundle. |
| `KOVA_PREVIEW_TTL_HOURS` | `24` | Preview deployment expiry window. |
| `KOVA_MAX_UPLOAD_BYTES` | `26214400` (25 MB) | ZIP upload cap. |
| `KOVA_SEED_DEMO_DATA` | `1` | Seed DEMO DATA users/projects/deployments on startup. |
| `KOVA_CORS_ORIGINS` | local dev origins | Allowed browser origins for the API. |

---

## 8. Verification evidence (this checkpoint)

| Check | Command | Result |
| --- | --- | --- |
| Backend test suite | `cd backend && python3 -m pytest -q` | **9 passed**, no warnings — confirmed after the secret-key fix. |
| Frontend build + typecheck | `cd frontend && npm run build` (`tsc -b && vite build`) | **Passed** — 79 modules transformed; JS 334.33 kB (gzip 96.83 kB), CSS 43.36 kB (gzip 9.00 kB). Re-run and passing with `react-router-dom ^7.18.5`. |
| Dependency security scan | AppJet `security` preset (OSV) | **0 high/critical** findings at revision 66 (down from 11). Two remaining MODERATE react-router advisories were addressed by the 7.18.5 upgrade; the recorded scan predates that change, so a fresh scan is pending. |
| Browser/UI interaction checks | — | **Not yet run.** |
| Docker image build / image scan | — | **Not possible yet — no Dockerfile (pending).** |
| Live deployment readiness | — | **Not yet deployed (no deployment recorded).** |

The security scanner reported `incomplete` (not a clean scan): `backend/requirements-dev.txt` has unresolved versions and `backend/requirements.txt` is treated as a manifest, so only explicitly pinned versions were checked. That status is not a pass.

---

## 9. Known errors, limitations and gotchas

1. **No Dockerfile yet** — the app cannot be built or deployed as a container until section 5 item 1 is completed.
2. **No provider integration** — deployments stay `queued` with `provider_state="not_configured"` and `preview_url=null`. This is intentional and surfaced in the UI, not a bug. Do not describe KOVA as actually deploying student projects.
3. **Security scan status is `incomplete`** (see section 8). The two react-router advisories fixed in 7.18.0 were remediated by the dependency upgrade, but the recorded scan report predates it; a fresh scan is still owed before this can be called clean.
4. **No browser-verified UI behaviour yet** — layouts are responsive by construction (CSS breakpoints, mobile drawer) but no viewport/interaction assertions have been recorded.
5. **SQLite is single-node** — fine for development and a small demo, not for concurrent multi-instance hosting. A managed database is required before any multi-replica deployment.
6. **Preview expiry is defined, not enforced** — `KOVA_PREVIEW_TTL_HOURS` exists and is surfaced as a policy in the UI, but nothing expires deployments because no real deployment is created.
7. **Tokens are stored in `localStorage`** — acceptable for this stage, but it means any XSS defect would expose sessions; a future hardening pass should move to httpOnly cookies.
8. **No rate limiting** on `/api/auth/login`, `/api/auth/register` or `/api/contact`. Should be added (plus a captcha/queue) before public exposure.
9. **`backend/.pytest_cache/*` files are tracked** in Git from an earlier commit even though `.gitignore` lists `.pytest_cache/`. Harmless, but they can be untracked later with `git rm -r --cached backend/.pytest_cache`.
10. **Demo data is seeded on startup by default** — set `KOVA_SEED_DEMO_DATA=0` for a clean instance. Seeded rows are labelled DEMO DATA.
11. **Uploads are stored on local disk** (`KOVA_UPLOAD_DIR`). A container deploy needs a persistent volume or object storage, otherwise uploads vanish on restart.

---

## 10. Checkpoint procedure / next steps

```bash
git switch appjet
git status          # expect a clean tree after this checkpoint commit
git log --oneline -5
git rev-parse HEAD
```

Next development order (after this checkpoint is saved):

1. Add the multi-stage `Dockerfile`, run `check_deployment`, deploy, and verify readiness.
2. Run the browser interaction checks (public pages, login, project create, deployment queue, admin queue, theme toggle, mobile).
3. Re-run the dependency security scan to confirm the react-router advisories are cleared.
4. Re-run `pytest` and `npm run build` after any further edits.

---

_Last updated: 2026-11-02 — Stage 1 checkpoint on branch `appjet`._
