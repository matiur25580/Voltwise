# Architecture Overview

## Current foundation

Voltwise is a TypeScript npm-workspaces monorepo with two independently deployable applications:

- **client:** React single-page application; presentation and client-side interaction only.
- **server:** Express API; authoritative business rules, authentication, authorization, tenant scoping, validation, and persistence.

The browser must never be trusted to supply an authoritative tenant identifier or permission decision. After authentication is implemented, the API will derive the active tenant and permissions from verified server-side identity/membership context.

## Target domain boundaries

| Domain | Responsibilities |
| --- | --- |
| Identity & tenancy | Users, organizations, memberships, roles, permissions, sessions |
| Sites & assets | Facilities, meters, inverters, batteries, chargers, equipment |
| Telemetry | Device identity, ingestion validation, normalization, retention |
| Energy intelligence | Consumption aggregates, forecasts, anomaly events |
| Flexibility | Demand-response programmes, events, commitments, measured response |
| Optimization | Constraints, candidate schedules, simulations, approval records |
| Maintenance | Asset health indicators, incidents, work orders |
| Sustainability | Emissions factors, calculation provenance, reporting |
| Platform operations | Audit events, notifications, jobs, observability |

## Data isolation

Every tenant-owned collection will include an immutable `tenantId` reference. API service methods must accept a trusted tenant context and include it in every read, update, and delete filter. Unique indexes that represent tenant-local uniqueness should include `tenantId`. Cross-tenant access tests are mandatory before the first tenant-facing release.

## Telemetry path (target)

1. A device authenticates using a device credential or gateway identity.
2. An ingestion adapter validates identity, schema, timestamp, units, and payload size.
3. The adapter normalizes measurements and applies idempotency/deduplication rules.
4. Valid readings are persisted and published to downstream processing.
5. Aggregation and intelligence jobs produce derived metrics with provenance.
6. The API exposes tenant-scoped history and live updates to authorized users.

MQTT and Socket.IO are planned integration choices, not part of the current foundation.

## Intelligence and safety

Forecasts and optimization outputs are advisory. Every result should record model/version, input window, generated timestamp, assumptions, and quality/confidence metadata. Critical equipment control is explicitly out of scope for autonomous AI execution. Any future command workflow requires policy validation, operator authorization, approval, and an auditable execution adapter.

## Initial deployment topology

- React static assets behind a CDN or frontend host.
- Express API behind HTTPS and a reverse proxy.
- MongoDB Atlas or managed MongoDB with backups and least-privilege credentials.
- Redis for distributed rate limiting and background jobs when required.
- Separate secrets per environment; no secrets in source control.
- CI checks for type safety, tests, and production builds.
