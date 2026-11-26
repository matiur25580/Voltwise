import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "../src/app.js";
import { rolePermissions } from "../src/modules/identity/identity.types.js";

describe("identity API security boundaries", () => {
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

  it("rejects protected identity endpoints without a bearer token", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`);
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("validates registration input before attempting persistence", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "A", email: "not-an-email", password: "short", organizationName: "X" })
    });
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps viewer permissions read-only", () => {
    expect(rolePermissions.viewer).toContain("energy:read");
    expect(rolePermissions.viewer).not.toContain("energy:write");
    expect(rolePermissions.viewer).not.toContain("members:manage");
    expect(rolePermissions.owner).toContain("billing:manage");
  });
});
