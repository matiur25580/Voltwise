# Voltwise ⚡

**AI-Powered Energy Intelligence & Grid Flexibility Platform**

Voltwise is an enterprise-oriented energy operations workspace for organizations that need to understand electricity demand, coordinate distributed energy assets, identify abnormal consumption, and make evidence-based optimization decisions.

> **Project status:** Identity, organization management, facility/asset registry, and the first device telemetry milestone are implemented on the development branch. Registered devices can submit validated readings through HTTP or the optional MQTT bridge; the workspace streams new events. The overview still contains clearly labelled demonstration metrics, and local simulator readings are synthetic rather than physical meter data.

## Product vision

Voltwise brings facility energy data, distributed energy resources, forecasting, operational workflows, and sustainability reporting into one multi-tenant platform. It is designed as a decision-support system: recommendations are explainable, traceable, and subject to human approval before any operational action.

## Planned capabilities

- Organization workspaces, secure identity, granular RBAC, and tenant isolation
- Facility/site hierarchy and tenant-scoped registries for meters, equipment, solar, batteries, inverters, and EV chargers
- Device telemetry ingestion via HTTP/MQTT, tenant-scoped real-time updates, and energy analytics
- Energy demand and renewable generation forecasting
- Consumption anomaly detection and explainable alerts
- Battery and flexible-load optimization simulation
- Demand-response programme coordination
- Predictive maintenance and work-order workflows
- Energy cost, carbon, and sustainability analytics
- Context-aware AI assistant with permission-scoped retrieval
- Audit trails, exports, reporting, and operational observability

## Technology

| Layer | Stack |
| --- | --- |
| Web | React, TypeScript, Vite |
| API | Node.js, Express, TypeScript |
| Data | MongoDB, Mongoose |
| Validation | Zod |
| Security | Helmet, CORS policy, rate limiting (foundation) |
| Real-time | MQTT.js adapter, Server-Sent Events |
| Jobs/cache (planned) | Redis, BullMQ |
| Testing (planned) | Vitest, Supertest, Playwright |
| Delivery | Docker Compose, GitHub Actions |

## Repository layout

```
.
├── client/                 # React application
├── server/                 # Express API
├── docs/                   # Architecture and delivery decisions
├── .github/workflows/      # CI workflows
├── docker-compose.yml
├── .env.example
└── package.json            # npm workspaces and root scripts
```

## Current registry capabilities\n\nThe authenticated workspace includes Facilities and Energy Assets sections. Organization members with the appropriate permissions can create and manage facilities and register equipment. Facility and asset APIs enforce tenant scoping, unique organization-level codes/tags, facility ownership checks, bounded pagination, and audit events. Asset deletion is a decommissioning transition so registry history is retained. See [docs/api-authentication.md](docs/api-authentication.md) for the current endpoint contract.\n\n## Energy analytics\n\nThe authenticated Energy analytics workspace aggregates persisted tenant telemetry into hourly or daily imported/exported energy and measured demand, provides optional flat-rate cost estimates, screens for consumption anomalies, and exports CSV. See [docs/energy-analytics.md](docs/energy-analytics.md) for calculation semantics and limitations.\n\n## Telemetry quick start

See [docs/telemetry-ingestion.md](docs/telemetry-ingestion.md) for device provisioning, the HTTP/MQTT payload contract, and security requirements. After provisioning a device in the Live telemetry workspace, start the local simulator with `DEVICE_CODE` and `DEVICE_KEY` environment variables using `npm run simulate:device`.

## Getting started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm 10+
- Docker Desktop (optional, for local MongoDB)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set a local MongoDB connection string in `.env`. Never commit real credentials.

### 3. Start MongoDB (optional)

```bash
docker compose up -d mongodb
```

### 4. Run the applications

```bash
npm run dev
```

- Web: http://localhost:5173
- API health: http://localhost:4000/api/v1/health

## Engineering principles

1. **Tenant isolation by design:** every tenant-owned query and mutation must be scoped on the server using the authenticated tenant context.
2. **Least privilege:** enforce permissions in API middleware and service boundaries, not only in the UI.
3. **Explainable intelligence:** forecasts and recommendations must expose their inputs, assumptions, timestamps, and confidence/quality indicators.
4. **Human-in-the-loop operations:** no autonomous control of critical energy equipment; actions require authorization and explicit approval.
5. **Data integrity:** validate incoming telemetry, use idempotency where appropriate, and retain provenance for derived metrics.
6. **Operational readiness:** health checks, structured logs, tests, migration/seed strategy, and documented recovery procedures are part of delivery.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for the milestone plan and [docs/architecture.md](docs/architecture.md) for architecture boundaries.

## Disclaimer

Voltwise is a software engineering portfolio project and decision-support prototype. It is not a certified energy management system, grid-control product, safety system, or substitute for qualified engineering review. Forecasts and savings scenarios must be validated against real site data before business use.
