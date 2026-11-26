const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const deviceCode = process.env.DEVICE_CODE;
const deviceKey = process.env.DEVICE_KEY;
const intervalMs = Number(process.env.INTERVAL_MS ?? 5000);

if (!deviceCode || !deviceKey) {
  console.error("Set DEVICE_CODE and DEVICE_KEY (shown once when provisioning a device).");
  process.exit(1);
}

let sequence = 0;
console.log(`Voltwise simulator started for ${deviceCode}; publishing every ${intervalMs}ms`);

async function publish() {
  sequence += 1;
  const power = 18 + Math.random() * 12;
  const payload = {
    eventId: `${deviceCode}-${Date.now()}-${sequence}`,
    timestamp: new Date().toISOString(),
    readings: [
      { metric: "active_power", value: Number(power.toFixed(3)), unit: "kW", quality: "good" },
      { metric: "energy_import", value: Number((power * intervalMs / 3_600_000).toFixed(5)), unit: "kWh", quality: "estimated" },
      { metric: "voltage", value: Number((228 + Math.random() * 8).toFixed(2)), unit: "V" },
      { metric: "frequency", value: Number((49.9 + Math.random() * 0.2).toFixed(3)), unit: "Hz" },
      { metric: "power_factor", value: Number((0.91 + Math.random() * 0.08).toFixed(3)), unit: "%" }
    ]
  };
  try {
    const response = await fetch(`${apiBaseUrl}/telemetry/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-code": deviceCode, "x-device-key": deviceKey },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? `HTTP ${response.status}`);
    console.log(new Date().toISOString(), result.data);
  } catch (error) { console.error("Telemetry publish failed:", error.message); }
}

await publish();
const timer = setInterval(() => void publish(), intervalMs);
process.on("SIGINT", () => { clearInterval(timer); process.exit(0); });
