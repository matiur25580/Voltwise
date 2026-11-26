# Delivery Roadmap

## Milestone 1 — Repository and application foundation
- [x] Establish TypeScript npm-workspaces monorepo
- [x] Add Express API bootstrap and database-aware health endpoints
- [x] Add React/Vite dashboard shell with clearly marked sample metrics
- [x] Add environment template, local MongoDB Compose service, and CI workflow
- [x] Document architecture boundaries and safety principles
- [x] Add baseline API tests for liveness, readiness, and structured 404 responses
- [ ] Verify clean install, automated tests, typechecks, and production builds in CI

## Milestone 2 — Enterprise identity and tenancy
- [x] User registration and login with bcrypt password hashing
- [x] Short-lived access tokens and rotating, revocable refresh sessions
- [x] Organization creation and initial owner membership
- [x] Organization membership listing and secure tenant switching
- [x] Role/permission model and server-side authorization middleware
- [x] Protected dashboard entry and client session lifecycle with in-memory access tokens
- [x] Tenant-scoped member administration and membership isolation in database queries
- [x] Tenant-scoped audit event model and organization/member security events
- [x] Tenant-scoped invitation creation, hashed one-time tokens, expiry, revocation, and authenticated acceptance
- [ ] Email delivery adapter and registration-time invitation acceptance
- [ ] Cross-tenant integration tests, transaction-backed concurrent last-owner protection, and full security review

## Milestone 3 — Facilities and energy assets
- [x] Tenant-scoped facility model with site hierarchy, address, timezone, floor area, and lifecycle status
- [x] Facility CRUD/list/detail APIs with bounded pagination, literal search, and hierarchy-cycle prevention
- [x] Meter, solar PV, inverter, battery, EV charger, HVAC, generator, transformer, and equipment asset registry
- [x] Asset lifecycle, status, manufacturer/model, serial, capacity, and metadata fields
- [x] Tenant-scoped asset CRUD/list/detail APIs with facility ownership validation and soft decommissioning
- [x] Audit events for facility and asset mutations
- [ ] Cross-tenant integration tests and management dashboard workflows
- [ ] Bulk import, facility geospatial search, and asset document attachments

## Milestone 4 — Telemetry and real-time operations
- [ ] Device credentials and ingestion contracts
- [ ] MQTT adapter and simulated device publisher
- [ ] Payload validation, normalization, idempotency, and ingestion observability
- [ ] Historical readings and real-time UI updates

## Milestone 5 — Energy intelligence
- [ ] Consumption aggregation and tariff-aware cost calculation
- [ ] Baseline forecasting and forecast evaluation
- [ ] Explainable anomaly detection and alert lifecycle
- [ ] Actual-versus-predicted analytics

## Milestone 6 — Flexibility and optimization
- [ ] Demand-response programmes and events
- [ ] Battery and flexible-load scheduling simulator
- [ ] Constraint-aware optimization recommendations
- [ ] Approval, audit, and outcome measurement

## Milestone 7 — Maintenance, sustainability, and AI assistant
- [ ] Equipment health indicators and maintenance work orders
- [ ] Emissions calculations with factor/source provenance
- [ ] Permission-scoped AI assistant with grounded responses
- [ ] AI-generated operational summaries with citations to platform records

## Milestone 8 — Production hardening
- [ ] Unit, integration, and end-to-end coverage
- [ ] Rate limiting, security headers, secrets and dependency review
- [ ] Structured logs, metrics, tracing, and alerting
- [ ] Backup/restore runbook and retention policies
- [ ] Accessibility, performance, and responsive design review
- [ ] Deployment pipeline and production documentation
