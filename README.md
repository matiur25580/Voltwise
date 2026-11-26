# Voltwise ⚡

**AI-Powered Energy Intelligence & Grid Flexibility Platform**

Voltwise is an enterprise-oriented energy operations workspace for organizations that need to understand electricity demand, coordinate distributed energy assets, identify abnormal consumption, and make evidence-based optimization decisions.

> **Project status:** Foundation milestone in active development. The current dashboard uses clearly labelled demonstration data. No live utility, meter, battery, inverter, or EV charger is connected yet.

## Product vision

Voltwise brings facility energy data, distributed energy resources, forecasting, operational workflows, and sustainability reporting into one multi-tenant platform. It is designed as a decision-support system: recommendations are explainable, traceable, and subject to human approval before any operational action.

## Planned capabilities

- Organization workspaces, secure identity, granular RBAC, and tenant isolation
- Facility, meter, equipment, solar, battery, and EV charger registries
- Device telemetry ingestion and real-time operational updates
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
| Real-time (planned) | Socket.IO, MQTT |
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
