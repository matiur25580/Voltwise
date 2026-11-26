import { describe, expect, it } from "vitest";
import { createDeviceCredential, telemetryPayloadSchema } from "./telemetry.service.js";

describe("telemetry contracts", () => {
  it("validates normalized measurement batches", () => {
    const payload = telemetryPayloadSchema.parse({
      eventId: "meter-001-0001",
      timestamp: new Date().toISOString(),
      readings: [{ metric: "active_power", value: 12.4, unit: "kW" }]
    });
    expect(payload.readings).toHaveLength(1);
    expect(payload.readings[0]?.quality).toBeUndefined();
    expect(telemetryPayloadSchema.safeParse({ eventId: "meter-001-0002", timestamp: new Date().toISOString(), readings: [{ metric: "power_factor", value: 0.97, unit: "1" }] }).success).toBe(true);
  });

  it("rejects empty, oversized, non-finite, or unknown measurements", () => {
    const base = { eventId: "meter-001-0001", timestamp: new Date().toISOString() };
    expect(telemetryPayloadSchema.safeParse({ ...base, tenantId: "untrusted", readings: [{ metric: "active_power", value: 1, unit: "kW" }] }).success).toBe(false);
    expect(telemetryPayloadSchema.safeParse({ ...base, readings: [] }).success).toBe(false);
    expect(telemetryPayloadSchema.safeParse({ ...base, readings: [{ metric: "made_up", value: 1, unit: "kW" }] }).success).toBe(false);
    expect(telemetryPayloadSchema.safeParse({ ...base, readings: [{ metric: "active_power", value: Infinity, unit: "kW" }] }).success).toBe(false);
    expect(telemetryPayloadSchema.safeParse({ ...base, readings: Array.from({ length: 51 }, () => ({ metric: "active_power", value: 1, unit: "kW" })) }).success).toBe(false);
  });

  it("creates high-entropy device credentials and stores only a hash", () => {
    const first = createDeviceCredential();
    const second = createDeviceCredential();
    expect(first.credential).not.toBe(second.credential);
    expect(first.credential).toHaveLength(43);
    expect(first.credentialHash).toHaveLength(64);
    expect(first.credentialHash).not.toBe(first.credential);
  });
});
