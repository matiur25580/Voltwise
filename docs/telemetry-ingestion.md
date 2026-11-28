# Device telemetry and IoT ingestion

All routes are prefixed with `/api/v1`. User-facing device administration and reading queries require a bearer access token and are scoped to the active organization.

## Device lifecycle

### Provision a device

`POST /devices` requires `assets:manage`.

```json
{
  "facilityId": "64f000000000000000000001",
  "assetId": "64f000000000000000000002",
  "deviceCode": "PUNE-MTR-001",
  "name": "Main incoming meter gateway"
}
```

The selected facility and asset must belong to the caller's active tenant, and the asset must belong to that facility. The API returns a randomly generated 256-bit `deviceCredential` exactly once. Only its SHA-256 hash is persisted. Store the plaintext credential in the device's secret manager; never commit or log it.

- `GET /devices` lists devices in the active tenant; requires `energy:read`.
- `POST /devices/:deviceId/revoke` revokes a credential; requires `assets:manage`. Revocation immediately prevents subsequent ingestion.
- Device codes are globally unique so an ingestion request resolves to one device identity.

## HTTP ingestion

`POST /telemetry/ingest` uses device authentication instead of a user access token.

Headers:
- `X-Device-Code: PUNE-MTR-001`
- `X-Device-Key: <one-time-provisioned-credential>`
- `Content-Type: application/json`

Body:

```json
{
  "eventId": "PUNE-MTR-001-1730000000000-1",
  "timestamp": "2026-11-27T10:30:00.000Z",
  "readings": [
    { "metric": "active_power", "value": 24.82, "unit": "kW", "quality": "good" },
    { "metric": "energy_import", "value": 0.0345, "unit": "kWh", "quality": "estimated" },
    { "metric": "voltage", "value": 230.4, "unit": "V" }
  ]
}
```

Supported metrics: active power, imported/exported energy, voltage, current, frequency, power factor, temperature, state of charge, generation power, and battery power. Units and quality markers are validated against an explicit allow-list. A batch contains 1–50 measurements.

Timestamps must be within the previous seven days and no more than five minutes in the future. Events are unique by tenant, device, and event ID. Retrying the same event returns an accepted duplicate response without storing a second event. Tenant, facility, asset, and device references are taken from the registered device, never from the submitted payload.

## Reading history and live updates

- `GET /telemetry/readings?limit=100&assetId=&deviceId=&from=&to=` returns tenant-scoped historical events; requires `energy:read`. Page size is capped at 500.
- `GET /telemetry/stream` is an authenticated Server-Sent Events stream. It publishes newly accepted events only to connected clients in the same tenant.

The stream fan-out is process-local. In a horizontally scaled deployment, replace it with a shared event bus (for example Redis Streams or a managed pub/sub service) and define replay/backfill semantics. The event collection is indexed for tenant/time and tenant/asset/time reads; retention and archival policies remain deployment decisions.

## MQTT bridge

Set `MQTT_BROKER_URL`, `MQTT_USERNAME`, and `MQTT_PASSWORD` to enable the optional MQTT subscriber at API startup. The bridge subscribes to `voltwise/ingest/+`; the final topic segment is the registered device code. Each JSON message has the same telemetry body as HTTP plus a `deviceCredential` field.

Use `mqtts://` with broker TLS, strict broker ACLs, private network access, and credential rotation in production. The device credential is carried in the MQTT payload and must not be logged by broker/application instrumentation. The broker service credentials are separate from individual device credentials.

## Local simulator

1. Register a facility and an energy asset in the workspace.
2. In Live telemetry, provision a device and copy its one-time credential.
3. Run the API and MongoDB.
4. In another terminal:

```bash
DEVICE_CODE=PUNE-MTR-001 DEVICE_KEY='<copied-credential>' npm run simulate:device
```

Optional variables: `API_BASE_URL` (defaults to `http://localhost:4000/api/v1`) and `INTERVAL_MS` (defaults to 5000).

The simulator publishes synthetic active power, imported energy, voltage, frequency, and power factor readings. These are generated demo readings, not measurements from physical equipment.

## Operational boundaries

The initial implementation persists validated event batches in MongoDB and provides an in-process SSE feed. It is not yet a high-throughput streaming platform: durable queue buffering, backpressure, dead-letter handling, schema version negotiation, per-device quotas, clock-drift diagnostics, retention/archival automation, MQTT end-to-end tests, and cross-tenant database integration tests are follow-up hardening work. Production deployments should load-test ingestion, use TLS, restrict broker ACLs, rotate device credentials, and alert on device inactivity.
