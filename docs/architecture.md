# Architecture Overview

## Current platform

Voltwise is a TypeScript npm-workspaces monorepo:

- **client:** React single-page application.
- **server:** Express API; authoritative business rules, authentication, authorization, tenant scoping, validation, and persistence.

## Identity and tenant isolation

Identity models are separated into users, organizations, memberships, and refresh sessions. A user may belong to multiple organizations through membership records. Each tenant-owned collection must include an immutable `tenantId` reference, and every tenant-facing service must scope reads and writes using a trusted tenant context.

The current API derives tenant context from a verified short-lived JWT and then re-checks active membership in MongoDB on every authenticated request. The role is loaded from the membership record rather than trusted from a stale client claim. The browser must never be trusted to supply an authoritative tenant identifier or permission decision.

### Authentication lifecycle

- Passwords are hashed with bcrypt (cost factor 12); plaintext passwords are never persisted.
- Access tokens are signed JWTs with issuer, audience, subject, tenant, and a short configurable lifetime.
- Refresh tokens are cryptographically random opaque values, stored only as SHA-256 hashes, and delivered in an HttpOnly cookie.
- Refresh rotates the token, revokes the previous token, and detects reuse of a revoked token by revoking the remaining token family.
- Logout revokes the presented refresh token. Production deployments must use HTTPS and a unique secret manager-provided JWT secret.

### RBAC

Roles currently include owner, admin, operator, analyst, and viewer. API middleware maps roles to explicit permissions. Membership status and role are reloaded server-side so a suspended or removed member cannot continue to access tenant APIs merely by holding an unexpired JWT.

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

## Hardening still required before production

Configure distributed rate limiting, CSRF protection appropriate to the deployed cookie topology, email verification, password reset, account lockout/abuse monitoring, audit events, session/device management, and transaction-backed registration. Review refresh-token family revocation under concurrent refresh requests and configure MongoDB TTL/index migrations as part of deployment.


## Organization context and auditability

Organization context is selected by a verified access-token claim and revalidated against an active `Membership` record for every authenticated request. Organization switching requires an active membership in the target organization, revokes the presented refresh session, and issues a new tenant-scoped session. Member-management queries include the trusted tenant ID in their filters. Security-sensitive membership and switching events are recorded in the tenant-scoped `AuditEvent` collection; secrets and token values are never written to audit metadata.


## Invitation security boundary

Organization invitations are tenant-scoped records with a cryptographically random one-time token. Only a SHA-256 token hash is persisted. Creation and revocation require member-management permission; acceptance requires an authenticated user whose normalized email matches the invitation target. The invitee receives only the role explicitly granted by the inviter, and the owner role is never assignable through invitations. The current API returns the plaintext token once to its trusted caller because an email delivery adapter is not yet configured; production deployment must connect a trusted mail provider and avoid exposing or logging that token.


## Facility and asset registry

The `Facility` and `EnergyAsset` collections are organization-scoped. All API queries include the tenant ID derived from the authenticated request context; asset creation verifies that the referenced facility belongs to the same tenant. Facility codes and asset tags are unique per organization. Parent facility references are tenant-validated and checked for cycles. Facilities are hard-deleted only when they have no assets or child facilities; energy assets are decommissioned through a soft lifecycle transition. Registry records and state changes are auditable. The registry is metadata only: telemetry ingestion, meter readings, and real-time device connectivity are intentionally separate capabilities.


## Device telemetry and ingestion

Each provisioned telemetry device is bound to one tenant, facility, and energy asset. Device codes are globally unique; 256-bit credentials are returned once and only SHA-256 hashes are persisted. HTTP ingestion authenticates the device independently of user sessions. The optional MQTT bridge resolves the same device identity from its topic and verifies the credential supplied in the message; production MQTT requires TLS and broker ACLs. Strict metric/unit validation, bounded timestamps, and a tenant/device/event unique key protect the ingestion boundary. Accepted events store their tenant, facility, asset, and device references from the trusted device record rather than from the payload.

Historical event reads and the SSE stream are tenant-scoped. The initial SSE fan-out is process-local and is suitable for a single API process; multi-instance deployments require a shared event bus and replay strategy. The current ingestion path persists directly to MongoDB and does not yet include durable queue buffering, backpressure, dead-letter handling, or automated retention.
