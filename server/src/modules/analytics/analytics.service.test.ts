import { describe, expect, it } from "vitest";
import { detectConsumptionAnomalies, type EnergyBucket } from "./analytics.service.js";

describe("energy analytics insights", () => {
  it("flags only material increases against preceding comparable buckets", () => {
    const series: EnergyBucket[] = [
      { bucket: "2026-11-01", importKwh: 100, exportKwh: 0, averageDemandKw: null, peakDemandKw: null, generationPowerKw: null },
      { bucket: "2026-11-02", importKwh: 110, exportKwh: 0, averageDemandKw: null, peakDemandKw: null, generationPowerKw: null },
      { bucket: "2026-11-03", importKwh: 90, exportKwh: 0, averageDemandKw: null, peakDemandKw: null, generationPowerKw: null },
      { bucket: "2026-11-04", importKwh: 150, exportKwh: 0, averageDemandKw: null, peakDemandKw: null, generationPowerKw: null }
    ];
    const anomalies = detectConsumptionAnomalies(series, 7);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.bucket).toBe("2026-11-04");
    expect(anomalies[0]?.severity).toBe("warning");
  });

  it("does not produce an anomaly without enough positive baseline buckets", () => {
    const series: EnergyBucket[] = [
      { bucket: "2026-11-01", importKwh: 0, exportKwh: 0, averageDemandKw: null, peakDemandKw: null, generationPowerKw: null },
      { bucket: "2026-11-02", importKwh: 0, exportKwh: 0, averageDemandKw: null, peakDemandKw: null, generationPowerKw: null },
      { bucket: "2026-11-03", importKwh: 0, exportKwh: 0, averageDemandKw: null, peakDemandKw: null, generationPowerKw: null },
      { bucket: "2026-11-04", importKwh: 200, exportKwh: 0, averageDemandKw: null, peakDemandKw: null, generationPowerKw: null }
    ];
    expect(detectConsumptionAnomalies(series)).toHaveLength(0);
  });
});
