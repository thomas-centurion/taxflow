# TaxFlow

TaxFlow is a full-stack tax compliance and automation platform designed to centralize tax obligations, deadlines, documents, notifications and audit activity for organizations.

The project is being developed as a portfolio project focused on enterprise-oriented software architecture, security, automation and cloud-ready development.

## Status

**MVP — actively evolving**

The current version includes authentication, role-based authorization, tax obligation management, dashboards, document management, notifications, scheduled deadline automation and audit logging.

The architecture is designed to evolve toward browser automation and Azure-based infrastructure in future phases.

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

A dedicated `automation/` directory is also reserved for future Puppeteer-based tax portal automation.

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

- Jest
- Supertest
- Integration/E2E tests

### Planned

- Puppeteer
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

The seed is idempotent.

### 6. Start the backend

The default configuration uses port `3000`.

```powershell
npm --prefix backend run start:dev
```

If port `3000` is already in use:

```powershell
$env:PORT = '3002'
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

PORT=3000
FRONTEND_ORIGIN=http://localhost:4200

STORAGE_LOCAL_PATH=./storage
NODE_ENV=development

SEED_USER_PASSWORD=Admin123!

JWT_SECRET=replace-this-with-a-random-secret-of-at-least-32-bytes
JWT_EXPIRES_IN=1d
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

`CANCELLED` and `APPROVED` obligations are excluded from the deadline workflow.

Active overdue obligations can transition to:

```text
OVERDUE
```

The automation is idempotent.

PostgreSQL uniqueness constraints prevent duplicate notifications when the same review is executed multiple times.

An authorized user can also trigger the deadline review manually:

```http
POST /api/automation/check-deadlines
```

This endpoint is restricted to `ADMIN` and `TAX_MANAGER`.

No email, SMS, WebSocket or external notification provider is currently used.

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

Examples include:

```text
CREATE
UPDATE
DELETE
LOGIN
LOGOUT
UPLOAD
DOWNLOAD
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

performed by the deadline scheduler is attributed to the system rather than a human user.

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

The seed is idempotent and safe to run repeatedly in the local development environment.

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

Backend build:

```powershell
npm --prefix backend run build
```

Frontend build:

```powershell
npm --prefix frontend run build
```

The test suite currently covers authentication, authorization, CRUD operations, documents, notifications, deadline automation and audit logging.

Frontend component/browser testing is not currently implemented as a full automated suite.

---

# Project Status

TaxFlow is currently under active development.

The first nine phases of the project have been completed, covering the core platform, authentication, REST API, Angular frontend, dashboard, document management, notifications, automation and audit logging.

Phases 10–13 are currently in progress and will extend the project with browser automation, expanded testing and documentation, production hardening and Azure-based infrastructure.

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

## In Progress

- [ ] Phase 10 — Puppeteer Automation
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

### Phase 10 — Puppeteer Automation

Browser-based automation against a controlled mock tax portal.

**Status: In progress**

### Phase 11 — Testing & API Documentation

Expanded automated testing, API documentation with Swagger and developer experience improvements.

**Status: In progress**

### Phase 12 — Release Hardening

Security review, configuration review, Docker improvements and production-readiness work.

**Status: In progress**

### Phase 13 — Azure Architecture

Migration toward Azure services such as Blob Storage, Functions, Service Bus, Entra ID and Azure DevOps CI/CD.

**Status: In progress**

# License

This project is currently intended as a portfolio and educational project.