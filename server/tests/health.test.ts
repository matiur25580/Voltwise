import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "../src/app.js";

describe("health endpoints", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it("reports process liveness without requiring MongoDB", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);
    const body = await response.json() as { status: string; service: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("voltwise-api");
  });

  it("reports database readiness separately", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const body = await response.json() as { status: string; checks: { database: string } };

    expect([200, 503]).toContain(response.status);
    expect(["connected", "disconnected"]).toContain(body.checks.database);
    expect(body.status).toMatch(/ready|degraded/);
  });

  it("returns a structured 404 for unknown routes", async () => {
    const response = await fetch(`${baseUrl}/api/v1/not-a-route`);
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});
