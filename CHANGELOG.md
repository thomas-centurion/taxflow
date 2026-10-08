# Changelog

## 1.0.0

First complete release of TaxFlow.

### Platform

- Angular frontend and NestJS REST API under `/api`, PostgreSQL with TypeORM migrations (`synchronize` disabled).
- Companies, countries, users and tax obligations with pagination, filtering and search.
- Status transition rules and a single overdue rule shared by the API, the scheduler and the `isOverdue` field.
- Dashboard with overdue and upcoming obligations, status distribution and companies with pending work.
- Document upload, download and deletion with content validation, a 10 MB limit and a storage abstraction (local filesystem).
- Per-user notifications for deadlines, documents, status changes and automation results, with deduplication.
- Daily deadline automation tracked as automation runs (manual or scheduled), idempotent, concurrency-safe and recovered after restarts.
- Append-only audit log of business and security events, with filters and change details.

### Security

- JWT authentication, bcrypt password hashing and role-based access control (`ADMIN`, `TAX_MANAGER`, `ANALYST`).
- Login rate limiting per client IP and email, audited failed logins, protection of the last active administrator.
- Helmet, strict DTO validation, CORS restricted to the web app origin, Swagger disabled in production.

### Quality

- Backend unit tests, HTTP E2E tests against an isolated `taxflow_test` database and an OpenAPI contract test.
- Frontend unit tests with Vitest.
- GitHub Actions pipeline: unit, E2E and frontend tests, builds, production dependency audit and production image validation.

### Production

- Docker images for the API (non-root, health check) and the web app (nginx proxying `/api`).
- Docker Compose profile for the production stack, migrations on startup, liveness and readiness endpoints.
- Production configuration: trust proxy for the rate limit behind proxies, optional PostgreSQL TLS, production log levels and graceful shutdown.
