# TaxFlow

TaxFlow is a full-stack tax compliance and automation platform designed to centralize tax obligations, deadlines, documents, notifications and audit activity for organizations.

The project is being developed as a portfolio project focused on enterprise-oriented software architecture, security, automation and cloud-ready development.

## Status

**MVP — actively evolving**

The current version includes authentication, role-based authorization, tax obligation management, dashboards, document management, notifications, scheduled deadline automation with a tracked execution history (automation runs) and audit logging.

The architecture is designed to evolve toward Azure-based infrastructure in future phases.

---

## Features

- JWT authentication
- Role-based access control
- Company management
- Country management
- Tax obligation management
- Due-date tracking
- Dashboard with real business data
- Document upload, download and deletion
- Local document storage abstraction
- File validation and size limits
- Persistent user notifications
- Automated deadline monitoring
- Idempotent notification generation
- Automatic overdue status changes
- Persistent audit logs
- Pagination and filtering
- Backend validation
- Database migrations
- Unit and integration tests
- Dockerized PostgreSQL environment

---

## Architecture

TaxFlow follows a modular full-stack architecture with a clear separation between presentation, business logic, persistence and infrastructure.

### Frontend

The frontend is built with Angular and TypeScript.

It is responsible for:

- User authentication and session handling
- Role-based UI access
- Dashboard and business views
- Tax obligation management
- Company and country management
- Document management
- Notifications
- Audit log visualization
- Reactive forms and client-side validation

Main technologies:

- Angular
- TypeScript
- Angular Material
- RxJS
- Reactive Forms

### Backend

The backend is built with NestJS and TypeScript following a modular architecture.

It is responsible for:

- Authentication and authorization
- Business rules
- REST API
- Data validation
- Tax obligation management
- Document management
- Notifications
- Deadline automation
- Audit logging

Main technologies:

- NestJS
- TypeScript
- TypeORM
- class-validator
- class-transformer
- JWT
- bcrypt

### Database

PostgreSQL is used as the main relational database.

TypeORM manages the entity model and database access, while schema changes are handled through explicit migrations.

The database stores:

- Users
- Companies
- Countries
- Tax obligations
- Document metadata
- Notifications
- Audit logs

Database synchronization is disabled in favor of explicit migrations.

### Storage

Document metadata is stored in PostgreSQL while binary files are handled through a storage abstraction.

The current implementation uses local filesystem storage for development.

The `StorageService` abstraction allows the storage provider to be replaced in the future with Azure Blob Storage without changing the business logic.

### Automation

Scheduled business processes are handled by the backend using NestJS scheduling.

Current automation includes:

- Deadline checks
- Upcoming deadline notifications
- Overdue obligation detection
- Automatic status changes
- Idempotent notification generation
- A tracked execution (automation run) per processed obligation, scheduled or manual, with recovery after restarts

See [Automation Runs (Phase 10)](#automation-runs-phase-10).

### Infrastructure

The project currently uses Docker for the local PostgreSQL environment.

The architecture is designed to evolve toward Azure services such as:

- Azure Blob Storage
- Azure Functions
- Azure Service Bus
- Microsoft Entra ID
- Azure DevOps CI/CD

These cloud integrations are part of the project roadmap and are not currently implemented.

---

## Tech Stack

### Frontend

- Angular
- TypeScript
- Angular Material
- RxJS
- Reactive Forms

### Backend

- NestJS
- Node.js
- TypeScript
- TypeORM
- PostgreSQL
- class-validator
- class-transformer

### Security

- JWT
- bcrypt
- Role-based access control
- Backend authorization guards
- Input validation
- Protected API routes

### Infrastructure

- Docker
- Docker Compose
- PostgreSQL

### Testing

- Node.js built-in test runner (`node:test`)
- HTTP E2E tests (`fetch`) against an isolated test database

### Planned

- Azure Blob Storage
- Azure Functions
- Azure Service Bus
- Microsoft Entra ID
- Azure DevOps CI/CD

---

## Roles

TaxFlow currently defines three roles:

| Role | Access |
|---|---|
| `ADMIN` | Full administrative access |
| `TAX_MANAGER` | Manage companies and tax obligations, plus business audit access |
| `ANALYST` | Read-only access |

The backend is the source of truth for authorization. Frontend controls are only a UX layer.

User administration rules:

- `GET /api/users` and `GET /api/users/:id` are limited to `ADMIN` and `TAX_MANAGER`. Creating, updating and deleting users is `ADMIN` only.
- `GET /api/users/options` is available to every authenticated role and returns only `id`, `firstName`, `lastName` and `email` of active users, for responsible-user pickers and filters.
- The system always keeps at least one active `ADMIN`: demoting, deactivating or deleting the last active `ADMIN` (including yourself) is rejected with `409 Conflict`.

---

## Local Setup

### Requirements

- Node.js 22 LTS
- npm
- Docker Desktop or Docker Engine with Docker Compose v2

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd TaxFlow
```

### 2. Configure environment variables

Copy `.env.example` to `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

The example configuration is intended only for local development.

Generate a unique random `JWT_SECRET` for any non-local environment.

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

The local PostgreSQL container is exposed on port `5433` to avoid conflicts with a native PostgreSQL installation.

### 4. Install backend dependencies

```bash
cd backend
npm install
```

### 5. Apply migrations and seed development data

From the repository root:

```powershell
npm --prefix backend run db:setup
```

The seed creates development data including:

- 3 users
- 4 countries
- 4 fictitious companies
- Sample tax obligations in different states

The seed only inserts missing records and never modifies existing ones, so it is safe to run repeatedly. It only runs with `NODE_ENV=development` or `NODE_ENV=test` and refuses any other value, including an unset `NODE_ENV`.

### 6. Start the backend

The development backend uses port `3002` (`PORT` in `.env`; also the default when `PORT` is not set).

```powershell
npm --prefix backend run start:dev
```

The API will then be available at:

```text
http://localhost:3002/api
```

Health check:

```text
http://localhost:3002/api/health
```

### 7. Start Angular

In another terminal:

```powershell
npm --prefix frontend install
npm --prefix frontend start -- --host 127.0.0.1 --port 4200
```

Open:

```text
http://localhost:4200
```

The Angular API configuration is centralized in:

```text
frontend/src/app/core/config/api.config.ts
```

It points to `http://localhost:3002/api`. If you change the backend `PORT`, update this file as well.

---

## Environment Variables

See `.env.example`.

Main variables:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=taxflow
DATABASE_USER=taxflow
DATABASE_PASSWORD=taxflow_dev_only

PORT=3002
FRONTEND_ORIGIN=http://localhost:4200

STORAGE_LOCAL_PATH=./storage
NODE_ENV=development

SEED_USER_PASSWORD=Admin123!

JWT_SECRET=replace-this-with-a-random-secret-of-at-least-32-bytes
JWT_EXPIRES_IN=1d

# Optional: login rate limit per client IP + email (defaults shown)
LOGIN_THROTTLE_LIMIT=5
LOGIN_THROTTLE_TTL_SECONDS=60
```

Do not commit `.env`.

Production environments must use unique secrets and secure credentials.

---

## Development Credentials

The development seed uses the value configured in:

```env
SEED_USER_PASSWORD
```

Default development credentials:

```text
Email:    admin@taxflow.local
Password: Admin123!
```

The seed users share the configured development password.

> These credentials are intended only for local development and must not be reused in production.

---

# Application

## Authentication

TaxFlow uses JWT-based authentication.

### Login

```http
POST /api/auth/login
```

Example:

```json
{
  "email": "admin@taxflow.local",
  "password": "Admin123!"
}
```

The API returns a Bearer token and an authenticated user profile without password hashes.

Login is rate limited per client IP and email (default: 5 attempts per 60 seconds, configurable with `LOGIN_THROTTLE_LIMIT` and `LOGIN_THROTTLE_TTL_SECONDS`). Exceeding the limit returns `429 Too Many Requests`. Invalid credentials always return the same generic `401` message, and failed attempts are audited as `LOGIN_FAILED` without passwords (the attempted email is stored only when it belongs to an existing account). Other endpoints are not rate limited.

### Current User

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

Most API endpoints require authentication.

---

## Tax Obligations

Tax obligations are the core business entity of TaxFlow.

Available operations:

```text
GET    /api/tax-obligations
GET    /api/tax-obligations/:id
POST   /api/tax-obligations
PATCH  /api/tax-obligations/:id
DELETE /api/tax-obligations/:id
```

Supported filters include:

- Company
- Country
- Status
- Type
- Responsible user
- Due date

List endpoints support pagination.

Example:

```text
GET /api/tax-obligations?page=1&limit=20&status=PENDING
```

---

## Dashboard

The authenticated `/app` route provides the main TaxFlow dashboard.

The dashboard uses real data from the API and includes:

- Total tax obligations
- Pending obligations
- In-progress obligations
- Submitted obligations
- Approved obligations
- Overdue obligations
- Upcoming deadlines
- Overdue obligations
- Distribution by obligation status
- Company summary
- Attention indicators

The dashboard retrieves the relevant paginated records before calculating global metrics.

No dashboard metrics are hardcoded or mocked.

---

## Documents

Documents are associated with tax obligations and the user who uploaded them.

PostgreSQL stores document metadata and a storage key.

Binary content is stored separately.

### Local Storage

By default:

```text
backend/storage/
```

Configurable with:

```env
STORAGE_LOCAL_PATH=./storage
```

The storage implementation is abstracted through `StorageService`.

### Limits

Maximum file size:

```text
10 MB
```

Supported document types:

- PDF
- PNG
- JPEG
- DOCX
- XLSX

The backend validates extension, MIME type and recognized file content.

### API

List documents:

```http
GET /api/tax-obligations/:id/documents
```

Upload:

```http
POST /api/tax-obligations/:id/documents
Content-Type: multipart/form-data
```

Form field:

```text
file
```

Download:

```http
GET /api/documents/:id/download
```

Delete:

```http
DELETE /api/documents/:id
```

`ADMIN` and `TAX_MANAGER` can upload and delete documents.

All authenticated roles can list and download documents.

The API prevents deletion of a tax obligation while it still has associated documents.

### Future Storage

The current implementation uses local storage for development.

The `StorageService` abstraction is designed to allow a future Azure Blob Storage implementation without coupling document business logic to the filesystem.

Azure Blob Storage is **not currently implemented**.

---

## Notifications and Deadline Automation

Notifications are persisted in PostgreSQL and are private to each authenticated user.

### API

List notifications:

```http
GET /api/notifications?page=1&limit=20
```

Filter unread notifications:

```http
GET /api/notifications?unread=true
```

Unread count:

```http
GET /api/notifications/unread-count
```

Mark one as read:

```http
PATCH /api/notifications/:id/read
```

Mark all as read:

```http
PATCH /api/notifications/read-all
```

Users can only access and modify their own notifications.

### Notification Events

Notifications can be generated when:

- A tax obligation changes status
- A document is uploaded
- A deadline approaches
- An obligation becomes overdue

### Deadline Automation

A NestJS scheduled job runs daily at 08:00 according to the local timezone of the running process.

Deadline notifications are generated at:

- 7 days before the deadline
- 3 days before the deadline
- 1 day before the deadline
- After the deadline

Only `PENDING` and `IN_PROGRESS` obligations take part in the deadline workflow. `SUBMITTED`, `APPROVED` and `CANCELLED` obligations are excluded.

An obligation is considered overdue when it is `OVERDUE`, or when it is `PENDING` / `IN_PROGRESS` and its due date is before the current date (backend process timezone). The rule lives in `backend/src/tax-obligations/tax-obligation-rules.ts`, and the API exposes it as the read-only `isOverdue` field.

Past-due `PENDING` / `IN_PROGRESS` obligations transition to:

```text
OVERDUE
```

Manual status changes are validated by the backend (`409 Conflict` when invalid):

| From | Allowed to |
|---|---|
| `PENDING` | `IN_PROGRESS`, `SUBMITTED`, `OVERDUE`*, `CANCELLED` |
| `IN_PROGRESS` | `PENDING`, `SUBMITTED`, `OVERDUE`*, `CANCELLED` |
| `OVERDUE` | `PENDING`**, `IN_PROGRESS`**, `SUBMITTED`, `CANCELLED` |
| `SUBMITTED` | `IN_PROGRESS`, `APPROVED` |
| `APPROVED` | — (final) |
| `CANCELLED` | — (final) |

\* Only when the due date is in the past. \*\* Only when the due date is moved to today or later.

The automation is idempotent.

PostgreSQL uniqueness constraints prevent duplicate notifications when the same review is executed multiple times.

An authorized user can also trigger the deadline review manually:

```http
POST /api/automation/check-deadlines
```

This endpoint is restricted to `ADMIN` and `TAX_MANAGER`.

No email, SMS, WebSocket or external notification provider is currently used.

---

## Automation Runs (Phase 10)

Deadline processing used to be a fire-and-forget batch: it changed statuses and sent alerts, but nobody could tell later when an obligation was last checked, by whom, or whether the check failed. Phase 10 turns each processing of an obligation into an **automation run**: a persisted, audited execution with a status, a structured result and a history, that can be triggered by the daily scheduler or on demand from the obligation detail.

### What a run does

For one obligation, inside a single database transaction:

1. checks that the obligation still needs follow-up (`PENDING`, `IN_PROGRESS` or `OVERDUE`);
2. applies the existing overdue rule (`tax-obligation-rules.ts`): a past-due `PENDING` / `IN_PROGRESS` obligation becomes `OVERDUE`, audited as a `SYSTEM` change linked to the run (`automationRunId`);
3. sends the deadline alerts that apply (7, 3 and 1 days before, or overdue) to the responsible user, through the existing deduplicated notifications;
4. returns a structured result: previous and resulting status, days until due, whether it was marked overdue, alerts created and whether the obligation has no responsible user.

No new tax rules are introduced: runs reuse the same rules, notifications and audit log as the rest of the backend, which remains the single source of truth.

### AutomationRun

Each run is stored in `automation_runs` (one obligation has many runs):

| Field | Meaning |
|---|---|
| `status` | `PENDING` → `RUNNING` → `SUCCEEDED` \| `FAILED`. Independent from the obligation status |
| `trigger` | `MANUAL` (a user) or `SCHEDULED` (the daily job) |
| `requestedBy` | The user for manual runs, `null` for scheduled ones |
| `startedAt` / `finishedAt` | Execution window (the result also stores `durationMs`) |
| `result` | The structured outcome described above |
| `errorCode` / `errorMessage` | Stable code and a non-sensitive message when the run failed |

### Scheduler

The existing NestJS job (`DeadlineSchedulerService`, daily at 08:00 in the backend process timezone) selects the obligations that need processing (open or overdue and due within 7 days) and processes each one in its own `SCHEDULED` run. Every obligation is handled independently: a failure is recorded on that obligation's run and the batch continues. `POST /api/automation/check-deadlines` runs the same batch on demand and returns a summary:

```json
{ "checked": 12, "notificationsCreated": 3, "overdueMarked": 1, "skippedWithoutResponsible": 0, "skippedActiveRun": 0, "failed": 0 }
```

### Avoiding duplicates

- **One active run per obligation:** a partial unique index (`status IN ('PENDING','RUNNING')`) makes PostgreSQL reject a second concurrent run, even across simultaneous requests. A manual request gets `409 Conflict`; the scheduler skips the obligation (`skippedActiveRun`).
- **Idempotent effects:** the overdue change is a conditional update, and deadline alerts use the existing notification deduplication keys. Running the same obligation twice records two runs but never changes or notifies twice.

### Errors and recovery

| `errorCode` | Meaning |
|---|---|
| `NOT_PROCESSABLE` | The obligation stopped needing follow-up (e.g. it was submitted), or its status changed while the run was processing it |
| `OBLIGATION_NOT_FOUND` | The obligation no longer exists |
| `INTERRUPTED` | The backend restarted while the run was active |
| `INTERNAL_ERROR` | Any unexpected error (its raw message is only logged, never stored) |

Because the processing is transactional, a failed or interrupted run leaves the obligation untouched. On startup, runs left `PENDING` / `RUNNING` by a previous process are marked `FAILED` with `INTERRUPTED`; the next run simply processes the obligation again.

### Audit and notifications

- Audit: `AUTOMATION_STARTED`, `AUTOMATION_SUCCEEDED` and `AUTOMATION_FAILED` on the `AutomationRun` entity (visible to `ADMIN` and `TAX_MANAGER`), attributed to the requesting user or to `SYSTEM`, plus the `SYSTEM` status change on the obligation.
- Notifications (type `AUTOMATION`, one per run and recipient): a manual run confirms its result to the requester; a failed run notifies the requester and the responsible user. Successful scheduled runs add nothing beyond the regular deadline alerts.

### API

```http
POST /api/tax-obligations/:id/automation-runs   # ADMIN, TAX_MANAGER — processes now, 201 with the finished run
GET  /api/tax-obligations/:id/automation-runs   # any authenticated role — last 20 runs, newest first
GET  /api/automation-runs/:id                   # any authenticated role
```

`POST` returns `409` when the obligation is `SUBMITTED`, `APPROVED` or `CANCELLED`, or is already being processed. A run that fails still answers `201`: the failure is part of the run (`status: FAILED`). All routes require a JWT; none is public.

### Running it manually

Apply the migrations (`npm --prefix backend run migration:run`, Phase 10 adds `automation_runs`), open an obligation and use **Procesar ahora** in the *Procesamiento automático* panel. The panel shows the latest run and the history of manual and scheduled runs.

### Limitations and evolution

- Runs execute synchronously inside the API process. That is enough here because processing is a short database operation, but a long batch holds one Node.js process.
- Restart recovery assumes a single backend instance: with several instances, one could mark another instance's active runs as interrupted.
- Run history grows by one row per obligation per scheduled day while it remains open or overdue; there is no retention policy yet.
- There are no automatic retries: a failed obligation is retried by the next scheduled run or manually.
- In production, the scheduler would publish one message per obligation to a queue (for example Azure Service Bus) consumed by workers (Azure Functions or container jobs) with retries, back-off and dead-lettering, and a distributed lock or a leased status would replace the startup recovery. `AutomationRun` and its partial unique index keep working unchanged in that model.

---

## Audit Logs

TaxFlow maintains a persistent audit trail for relevant business actions.

Audit logs are append-only from the public API.

There are no endpoints to create, modify or delete audit logs directly.

### API

```http
GET /api/audit-logs
```

The endpoint supports pagination and filtering.

Available filters:

- Action
- Entity type
- Entity ID
- Actor
- Date from
- Date to

`dateFrom` and `dateTo` must use the `YYYY-MM-DD` format and are inclusive calendar days in the backend process timezone. Datetimes, invalid dates and ranges where `dateFrom` is after `dateTo` return `400 Bad Request`.

Example:

```text
GET /api/audit-logs?action=UPDATE&entityType=TaxObligation
```

Logs are returned newest first.

### Audited Actions

The system audits relevant actions involving:

- Users
- Companies
- Countries
- Tax obligations
- Documents
- Notifications
- Automation runs

Examples include:

```text
CREATE
UPDATE
DELETE
LOGIN
LOGIN_FAILED
LOGOUT
UPLOAD
DOWNLOAD
AUTOMATION_STARTED
AUTOMATION_SUCCEEDED
AUTOMATION_FAILED
```

Updates record only fields that actually changed.

Example:

```json
{
  "status": {
    "before": "PENDING",
    "after": "SUBMITTED"
  }
}
```

PATCH requests that do not change data do not create unnecessary UPDATE events.

### System Actions

Automated operations are identified as:

```text
SYSTEM
```

For example:

```text
PENDING → OVERDUE
```

performed by the deadline scheduler is attributed to the system rather than a human user. The same applies when a user runs the processing manually: the run is attributed to the user, while the status change comes from the system rule and references the run (`automationRunId`).

### Sensitive Information

Audit metadata never stores:

- Passwords
- Password hashes
- JWTs
- Secrets
- Credentials
- Physical filesystem paths
- Binary document contents

The actor for human actions is taken from the authenticated backend context and cannot be supplied arbitrarily by the frontend.

### Access

- `ADMIN`: full audit access
- `TAX_MANAGER`: business-related audit access
- `ANALYST`: no audit access

The frontend provides:

```text
/app/audit-logs
```

with filters, pagination and a readable event detail view.

---

# Database

TaxFlow uses PostgreSQL with TypeORM.

Database schema changes are managed through explicit migrations.

`synchronize` is disabled.

Apply pending migrations:

```powershell
npm --prefix backend run migration:run
```

Show migration status:

```powershell
npm --prefix backend run migration:show
```

Initialize the local schema and development seed:

```powershell
npm --prefix backend run db:setup
```

The seed only inserts missing records (it never changes passwords, roles, active flags, statuses or due dates of existing data), is safe to run repeatedly in the local development environment, and only runs with `NODE_ENV=development` or `NODE_ENV=test` (any other value, including an unset `NODE_ENV`, is refused).

## Dates and Timezone

- `dueDate` is a PostgreSQL `date` (calendar day, no time or timezone), exchanged as `YYYY-MM-DD`.
- "Today" is the calendar date of the backend process timezone. The overdue rule, the deadline scheduler, the `isOverdue` API field, the seed and the audit-log date filters all use this same reference.
- The frontend displays due dates as calendar days without timezone conversion and does not recompute overdue status.
- Event timestamps (`createdAt`, `updatedAt`) are `timestamptz` and are displayed in the browser's local time.

---

# Testing

Backend unit tests:

```powershell
npm --prefix backend test
```

Backend integration/E2E tests:

```powershell
npm --prefix backend run test:e2e
```

The E2E runner (`backend/test/run-e2e.cjs`) never uses the development database or API. On every run it:

1. drops and recreates a disposable `<DATABASE_NAME>_test` database (`taxflow_test` by default) on the same PostgreSQL server,
2. applies the migrations and the seed to it,
3. starts a dedicated backend on port `3100` (`E2E_PORT`) with temporary document storage,
4. runs every `backend/test/*.e2e.cjs` file and stops the backend.

PostgreSQL must be running (`docker compose up -d postgres`). The development backend can keep running on `3002`. E2E files refuse to run without the runner-provided `TAXFLOW_API_URL`.

Backend build:

```powershell
npm --prefix backend run build
```

Frontend build:

```powershell
npm --prefix frontend run build
```

The test suite currently covers authentication, login rate limiting, authorization, CRUD operations, relation integrity, status transitions, documents, notifications, deadline automation, automation runs (lifecycle, idempotency, concurrency, restart recovery, scheduler and API), audit logging and seed safety.

Frontend component/browser testing is not currently implemented as a full automated suite.

---

# Project Status

TaxFlow is currently under active development.

The first ten phases of the project have been completed, covering the core platform, authentication, REST API, Angular frontend, dashboard, document management, notifications, automation, audit logging and tracked automation runs with background processing.

Phases 11–13 are planned and will extend the project with expanded testing and documentation, production hardening and Azure-based infrastructure. A stabilization pass before Phase 10 already added isolated E2E tests and some hardening (login rate limiting, last-admin protection, safe seed).

## Completed Phases

- [x] Phase 1 — Foundation
- [x] Phase 2 — Data Model
- [x] Phase 3 — Authentication & RBAC
- [x] Phase 4 — REST API
- [x] Phase 5 — Angular Integration
- [x] Phase 6 — Dashboard
- [x] Phase 7 — Document Management
- [x] Phase 8 — Notifications & Automation
- [x] Phase 9 — Audit Logs
- [x] Phase 10 — Automation & Background Processing

## Planned

- [ ] Phase 11 — Testing & API Documentation
- [ ] Phase 12 — Release Hardening
- [ ] Phase 13 — Azure Architecture

---

# Roadmap

The project is being developed incrementally.

### Phase 1 — Foundation

Project structure, Docker, PostgreSQL and initial backend/frontend setup.

### Phase 2 — Data Model

Relational entities, relationships, migrations and development seed.

### Phase 3 — Authentication & RBAC

JWT authentication, password hashing and role-based authorization.

### Phase 4 — REST API

CRUD operations, DTO validation, pagination, filtering and permissions.

### Phase 5 — Angular Integration

Authentication flow, protected routes, API integration and business views.

### Phase 6 — Dashboard

Business metrics, deadlines, status distribution and company summaries.

### Phase 7 — Document Management

Document upload, validation, local storage and download/delete workflows.

### Phase 8 — Notifications & Automation

Persistent notifications, deadline monitoring, idempotency and scheduled processing.

### Phase 9 — Audit Logs

Persistent audit trail, business event tracking and audit visualization.

### Phase 10 — Automation & Background Processing

Tracked automation runs per obligation (manual or scheduled), idempotent and concurrency-safe execution, error handling, restart recovery, audit, notifications and run history.

**Status: Completed**

### Phase 11 — Testing & API Documentation

Expanded automated testing, API documentation with Swagger and developer experience improvements.

**Status: Planned**

### Phase 12 — Release Hardening

Security review, configuration review, Docker improvements and production-readiness work.

**Status: Planned**

### Phase 13 — Azure Architecture

Migration toward Azure services such as Blob Storage, Functions, Service Bus, Entra ID and Azure DevOps CI/CD.

**Status: Planned**

# License

This project is currently intended as a portfolio and educational project.