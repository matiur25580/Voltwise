import mqtt, { type MqttClient } from "mqtt";
import { logger } from "../../lib/logger.js";
import { ingestTelemetry } from "./telemetry.service.js";

let client: MqttClient | undefined;

export function startMqttAdapter(brokerUrl: string | undefined, username?: string, password?: string) {
  if (!brokerUrl || client) return;
  client = mqtt.connect(brokerUrl, {
    ...(username ? { username } : {}), ...(password ? { password } : {}), reconnectPeriod: 5_000, connectTimeout: 10_000,
    clean: true, clientId: `voltwise-ingest-${process.pid}`
  });
  client.on("connect", () => {
    logger.info("MQTT telemetry adapter connected");
    client?.subscribe("voltwise/ingest/+", { qos: 1 }, (error) => {
      if (error) logger.error({ err: error }, "MQTT telemetry subscription failed");
    });
  });
  client.on("message", (topic, message) => {
    const deviceCode = topic.split("/").at(-1) ?? "";
    try {
      const payload = JSON.parse(message.toString()) as { deviceCredential?: string; [key: string]: unknown };
      const { deviceCredential, ...telemetry } = payload;
      void ingestTelemetry(deviceCode, deviceCredential ?? "", telemetry).catch((error: unknown) => {
        logger.warn({ deviceCode, err: error }, "MQTT telemetry message rejected");
      });
    } catch (error) { logger.warn({ deviceCode, err: error }, "MQTT telemetry payload was not valid JSON"); }
  });
  client.on("error", (error) => logger.error({ err: error }, "MQTT telemetry adapter error"));
}

export async function stopMqttAdapter() {
  if (!client) return;
  const current = client; client = undefined;
  await new Promise<void>((resolve) => current.end(false, {}, () => resolve()));
}
