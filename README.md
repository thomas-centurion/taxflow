# TaxFlow

TaxFlow is a full-stack tax compliance and automation platform that centralizes tax obligations, deadlines, documents, notifications and audit activity for organizations.

It is a portfolio project focused on enterprise-oriented architecture, security, automation and production readiness.

**Status: v1.0.0, feature-complete.** Changes are listed in [CHANGELOG.md](CHANGELOG.md).

---

## Features

- **Tax obligations:** CRUD with filters (company, country, status, type, responsible user, due date), search and pagination. Status transitions are validated by the backend.
- **Deadlines:** a single overdue rule, a daily automated check and manual processing per obligation, each tracked as an *automation run*.
- **Notifications:** per-user alerts 7, 3 and 1 days before a deadline, when it is overdue, on status changes, new documents and automation results. Duplicates are prevented by the database.
- **Documents:** upload, download and deletion of PDF, PNG, JPEG, DOCX and XLSX files up to 10 MB, with extension, MIME type and content validation.
- **Dashboard** with real data: overdue and upcoming obligations, status distribution and companies with pending work.
- **Companies, countries and users**, with integrity rules (for example, at least one active `ADMIN` always remains).
- **Audit log** of business and security events, append-only from the API.
- **Security:** JWT authentication, role-based access control, rate-limited login and a read-only demo mode.
- **Quality:** OpenAPI/Swagger docs, unit, E2E and frontend tests, GitHub Actions CI, and production Docker images with health checks.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Angular 20 (standalone components, signals), Angular Material, RxJS, Reactive Forms |
| Backend | NestJS 11, TypeORM, class-validator, Passport JWT, bcrypt, Helmet, `@nestjs/schedule` |
| Database | PostgreSQL 16 with explicit migrations (`synchronize` disabled) |
| Testing | `node:test` (backend unit and HTTP E2E), Vitest + jsdom (frontend) |
| Infrastructure | Docker, Docker Compose, nginx, GitHub Actions |

## Architecture

An Angular SPA calls a NestJS REST API under `/api`. The API owns authentication, authorization, business rules, auditing and the daily automation, and persists to PostgreSQL. Document contents are stored behind a `StorageService` abstraction; the only implementation is local filesystem storage. Azure Blob Storage and S3 are **not** implemented. There are no queues or external services at runtime.

```text
.
├── backend/                 NestJS API
│   ├── src/                 auth, users, companies, countries, tax-obligations, documents,
│   │                        notifications, automation, audit, health, common, database
│   ├── test/                unit (*.test.cjs), E2E (*.e2e.cjs) and the E2E runner
│   └── Dockerfile
├── frontend/                Angular application (core, feature pages, shared UI)
│   ├── nginx.conf
│   └── Dockerfile
├── scripts/                 docker-smoke-test.sh
├── .github/workflows/       ci.yml
├── docker-compose.yml       PostgreSQL (dev) and the production stack (profile "app")
└── .env.example
```

## Roles

| Role | Access |
|---|---|
| `ADMIN` | Full access, including users, countries and the full audit log |
| `TAX_MANAGER` | Manages companies, obligations, documents and automations; business audit log |
| `ANALYST` | Read-only access to business data; no audit log |

- The backend is the source of truth for authorization. Frontend controls are only a UX layer.
- Every authenticated role can use `GET /api/users/options` (active users' name and email) for pickers.
- Demoting, deactivating or deleting the last active `ADMIN` is rejected with `409`.

---

## Getting Started

Requirements: Node.js 22 LTS (22.12+), npm, and Docker with Compose v2.

```bash
cp .env.example .env                 # PowerShell: Copy-Item .env.example .env
docker compose up -d postgres        # PostgreSQL on host port 5433
npm --prefix backend install
npm --prefix frontend install
npm --prefix backend run db:setup    # migrations + development seed
npm --prefix backend run start:dev   # API at http://localhost:3002/api
npm --prefix frontend start          # in another terminal: http://localhost:4200
```

- The seed creates `admin@taxflow.local`, `manager@taxflow.local` and `analyst@taxflow.local`, all with the password set in `SEED_USER_PASSWORD`. These are development credentials only.
- The seed only inserts missing data and refuses to run unless `NODE_ENV` is `development` or `test`.
- The frontend's development API URL is in `frontend/src/app/core/config/api.config.ts` (`http://localhost:3002/api`). Update it if you change `PORT`.
- Health checks: `/api/health` (liveness) and `/api/health/ready` (PostgreSQL reachable, `503` otherwise).

## Configuration

All backend settings are environment variables, documented in [`.env.example`](.env.example). Never commit `.env`.

| Variable | Notes |
|---|---|
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | Connection; user and password are required |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Secret of at least 32 bytes (the API refuses to start otherwise); default expiry `1d` |
| `PORT`, `FRONTEND_ORIGIN` | API port (default `3002`) and the single CORS origin |
| `NODE_ENV` | `production` disables Swagger, debug logs and the seed |
| `DATABASE_MIGRATIONS_RUN` | `true` applies pending migrations on startup (production images have no ts-node) |
| `DATABASE_SSL`, `DATABASE_SSL_CA_FILE` / `DATABASE_SSL_CA` | TLS to PostgreSQL, always with certificate verification; set the CA for providers with a private CA (e.g. Supabase) |
| `TRUST_PROXY` | Number of proxies in front of the API, so the login rate limit sees the client IP |
| `LOGIN_THROTTLE_LIMIT`, `LOGIN_THROTTLE_TTL_SECONDS` | Login rate limit per IP + email (default 5 per 60 s) |
| `STORAGE_LOCAL_PATH`, `SWAGGER_ENABLED`, `DEMO_READ_ONLY_EMAILS` | Document storage path, Swagger override, read-only demo accounts |

---

## API

Swagger UI is served at `http://localhost:3002/api/docs` (JSON at `/api/docs-json`). It is on by default except with `NODE_ENV=production`, and `SWAGGER_ENABLED` overrides it. It documents all 39 operations with their roles and error responses. To try protected routes, call `POST /api/auth/login`, press **Authorize** and paste the `accessToken`.

| Resource | Routes | Write access |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | — |
| Users | `/users`, `/users/:id`, `/users/options` | `ADMIN` |
| Countries | `/countries`, `/countries/:id` | `ADMIN` |
| Companies | `/companies`, `/companies/:id` | `ADMIN`, `TAX_MANAGER` |
| Tax obligations | `/tax-obligations`, `/tax-obligations/:id` | `ADMIN`, `TAX_MANAGER` |
| Documents | `/tax-obligations/:id/documents`, `/documents/:id/download`, `/documents/:id` | `ADMIN`, `TAX_MANAGER` |
| Notifications | `/notifications`, `/notifications/unread-count`, `/notifications/read-all`, `/notifications/:id/read` | Own notifications only |
| Automation | `/tax-obligations/:id/automation-runs`, `/automation-runs/:id`, `POST /automation/check-deadlines` | `ADMIN`, `TAX_MANAGER` |
| Audit logs | `GET /audit-logs` | Read-only |
| Health | `GET /health`, `GET /health/ready` | Public |

Lists use `page` and `limit` (max 100) and return `{ data, meta }`. Errors keep the NestJS format `{ statusCode, message, error? }`. Login is rate limited and returns the same generic `401` for any invalid credentials.

---

## Business Rules

### Status transitions

Invalid manual changes return `409 Conflict`.

| From | Allowed to |
|---|---|
| `PENDING` | `IN_PROGRESS`, `SUBMITTED`, `OVERDUE`*, `CANCELLED` |
| `IN_PROGRESS` | `PENDING`, `SUBMITTED`, `OVERDUE`*, `CANCELLED` |
| `OVERDUE` | `PENDING`**, `IN_PROGRESS`**, `SUBMITTED`, `CANCELLED` |
| `SUBMITTED` | `IN_PROGRESS`, `APPROVED` |
| `APPROVED`, `CANCELLED` | — (final) |

\* Only when the due date is in the past. \*\* Only when the due date is moved to today or later.

An obligation is **overdue** when it is `OVERDUE`, or `PENDING`/`IN_PROGRESS` with a due date before today. "Today" is the date in the backend process timezone. The rule lives in `tax-obligation-rules.ts` and is exposed as the read-only `isOverdue` field; the frontend never recomputes it.

### Deadline automation

A daily job (08:00, backend timezone) processes the open or overdue obligations due within 7 days. Each obligation runs as its own **automation run**: a persisted, audited execution with a status (`PENDING → RUNNING → SUCCEEDED | FAILED`), a structured result and a history. A run, in one transaction:

- marks a past-due obligation `OVERDUE`, audited as a `SYSTEM` change;
- sends the deadline alerts to the responsible user.

Runs can also be started manually from the obligation detail (**Procesar ahora**) or for the whole batch with `POST /api/automation/check-deadlines`.

- **No duplicates:** a partial unique index allows one active run per obligation (a concurrent manual request gets `409`). The overdue change is conditional and notifications are deduplicated, so repeating a run never repeats its effects.
- **Failures:** a run stores a stable `errorCode` (`NOT_PROCESSABLE`, `OBLIGATION_NOT_FOUND`, `INTERRUPTED`, `INTERNAL_ERROR`) and leaves the obligation untouched. Runs left active by a restart are marked `INTERRUPTED` on startup.
- **Limits:** processing is synchronous inside the API, assumes a single instance, and has no automatic retries or retention policy.

### Documents

Metadata lives in PostgreSQL. The file goes to `StorageService` under a server-generated key (`STORAGE_LOCAL_PATH`, by default `backend/storage/`). Uploads are validated for size, extension, MIME type and file signature. If saving the metadata fails, the stored file is removed; if deleting the metadata fails, the file is restored. An obligation with documents cannot be deleted.

### Audit logs

Creates, updates (only the changed fields), deletes, logins, failed logins, logouts, uploads, downloads, notification events and automation runs are recorded in the same transaction as the change. Automated changes are attributed to `SYSTEM`, and the actor of human actions is always taken from the authenticated user. Metadata never stores passwords, tokens, secrets, file paths or file contents.

`ADMIN` sees every event, `TAX_MANAGER` only business entities and `ANALYST` nothing. Filters: action, entity type, entity ID, actor, and date range (`YYYY-MM-DD`, inclusive).

### Demo mode (read-only)

`DEMO_READ_ONLY_EMAILS` lists existing accounts that cannot write. A global guard returns `403` to every `POST`/`PUT`/`PATCH`/`DELETE` from those accounts, on any route. These accounts can also read the business audit log, and the web app hides every write action. Before publishing demo credentials:

1. Use a dedicated `ANALYST` account.
2. Change the passwords of the other seed accounts: they share `SEED_USER_PASSWORD`.
3. Confirm `readOnly: true` in `GET /api/auth/me`.
4. Use fictitious data only.

---

## Production

Two images run with Docker Compose:

- **`backend/Dockerfile`:** the compiled API, running as a non-root user, with a health check on `/api/health/ready`. It applies migrations on startup.
- **`frontend/Dockerfile`:** the Angular build on unprivileged nginx, proxying `/api` to the API.

```bash
cp .env.example .env    # set a unique JWT_SECRET and a real DATABASE_PASSWORD
docker compose --profile app up -d --build
sh scripts/docker-smoke-test.sh    # read-only checks
```

The app is served at `http://localhost:8080`. A production installation starts empty: the seed refuses `NODE_ENV=production`.

Notes:

- The production Angular build calls the API deployed on Render (`api.config.production.ts`), which uses PostgreSQL on Supabase. Inside the Compose stack, the browser therefore talks to that API rather than nginx's `/api` proxy.
- For Supabase, set `DATABASE_SSL=true` and provide its CA through `DATABASE_SSL_CA_FILE` (for example a Render secret file) **before** deploying. Certificate verification cannot be disabled.
- Terminate HTTPS in front of the API and set `TRUST_PROXY`. Back up the database and the document storage together.

---

## Testing and CI

```bash
npm --prefix backend test            # backend build + unit tests
npm --prefix backend run test:e2e    # E2E against a disposable taxflow_test database
npm --prefix frontend test           # frontend tests (Vitest)
```

- The E2E runner drops and recreates `taxflow_test` on every run, starts its own backend on port `3100`, and never touches the development database. It needs PostgreSQL running.
- The suites cover authentication and token tampering, rate limiting, authorization, CRUD and integrity rules, status transitions, documents, notifications, automation runs (including concurrency and restart recovery), audit logging, the demo mode, seed safety and an OpenAPI contract test.

GitHub Actions runs three jobs on every pull request and push to `main`:

- **Backend:** unit and E2E tests against a throwaway PostgreSQL.
- **Frontend:** tests and the production build.
- **Production:** builds the Docker images, starts the stack, and runs the smoke test and a demo login.

Both the backend and frontend jobs fail on high or critical vulnerabilities in production dependencies. No repository secrets are needed.

## Known Limitations

- Single API instance assumed by the scheduler and the restart recovery.
- Local document storage only. Files are lost on hosts with an ephemeral filesystem.
- JWTs are stored in `localStorage` and are not revoked on logout, and the web app has no Content-Security-Policy.
- No ESLint/Prettier and no browser end-to-end tests. Some dev-only `npm audit` advisories (Vitest, Angular CLI) remain until an Angular 21 upgrade.

## License

This project is intended as a portfolio and educational project.
