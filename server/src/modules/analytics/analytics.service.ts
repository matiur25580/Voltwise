import { Types } from "mongoose";
import { TelemetryEvent } from "../telemetry/telemetry-event.model.js";

export type EnergyBucket = {
  bucket: string;
  importKwh: number;
  exportKwh: number;
  averageDemandKw: number | null;
  peakDemandKw: number | null;
  generationPowerKw: number | null;
};

export function detectConsumptionAnomalies(series: EnergyBucket[], windowSize = 7) {
  return series.flatMap((point, index) => {
    const history = series.slice(Math.max(0, index - windowSize), index)
      .map((item) => item.importKwh).filter((value) => value > 0);
    if (history.length < 3) return [];
    const baselineKwh = history.reduce((sum, value) => sum + value, 0) / history.length;
    const deviationPercent = ((point.importKwh - baselineKwh) / baselineKwh) * 100;
    if (deviationPercent < 25) return [];
    return [{
      bucket: point.bucket,
      observedKwh: Number(point.importKwh.toFixed(3)),
      baselineKwh: Number(baselineKwh.toFixed(3)),
      deviationPercent: Number(deviationPercent.toFixed(1)),
      severity: deviationPercent >= 75 ? "high" as const : "warning" as const,
      explanation: `Imported energy was ${deviationPercent.toFixed(1)}% above the preceding ${history.length} comparable buckets.`
    }];
  });
}

export async function getEnergyAnalytics(input: {
  tenantId: string; from: Date; to: Date; granularity: "hour" | "day";
  assetId?: string; tariffRate?: number;
}) {
  const match: Record<string, unknown> = {
    tenantId: new Types.ObjectId(input.tenantId),
    occurredAt: { $gte: input.from, $lte: input.to }
  };
  if (input.assetId) match.assetId = new Types.ObjectId(input.assetId);
  const unitToKilo = {
    $cond: [{ $in: ["$readings.unit", ["Wh", "W"]] }, { $divide: ["$readings.value", 1000] }, "$readings.value"]
  };
  const rows = await TelemetryEvent.aggregate<EnergyBucket>([
    { $match: match },
    { $unwind: "$readings" },
    { $match: { "readings.metric": { $in: ["energy_import", "energy_export", "active_power", "generation_power"] } } },
    { $addFields: {
      bucket: { $dateToString: {
        format: input.granularity === "hour" ? "%Y-%m-%dT%H:00:00.000Z" : "%Y-%m-%d",
        date: "$occurredAt", timezone: "UTC"
      } },
      normalizedValue: unitToKilo
    } },
    { $group: {
      _id: "$bucket",
      importKwh: { $sum: { $cond: [{ $eq: ["$readings.metric", "energy_import"] }, "$normalizedValue", 0] } },
      exportKwh: { $sum: { $cond: [{ $eq: ["$readings.metric", "energy_export"] }, "$normalizedValue", 0] } },
      averageDemandKw: { $avg: { $cond: [{ $eq: ["$readings.metric", "active_power"] }, "$normalizedValue", null] } },
      peakDemandKw: { $max: { $cond: [{ $eq: ["$readings.metric", "active_power"] }, "$normalizedValue", null] } },
      generationPowerKw: { $max: { $cond: [{ $eq: ["$readings.metric", "generation_power"] }, "$normalizedValue", null] } }
    } },
    { $project: {
      _id: 0, bucket: "$_id", importKwh: 1, exportKwh: 1,
      averageDemandKw: 1, peakDemandKw: 1, generationPowerKw: 1
    } },
    { $sort: { bucket: 1 } }
  ]);
  const series = rows.map((row) => ({
    ...row,
    importKwh: Number((row.importKwh ?? 0).toFixed(3)),
    exportKwh: Number((row.exportKwh ?? 0).toFixed(3)),
    averageDemandKw: row.averageDemandKw === null ? null : Number(row.averageDemandKw.toFixed(3)),
    peakDemandKw: row.peakDemandKw === null ? null : Number(row.peakDemandKw.toFixed(3)),
    generationPowerKw: row.generationPowerKw === null ? null : Number(row.generationPowerKw.toFixed(3))
  }));
  const totals = series.reduce((result, point) => ({
    importKwh: result.importKwh + point.importKwh,
    exportKwh: result.exportKwh + point.exportKwh,
    peakDemandKw: Math.max(result.peakDemandKw, point.peakDemandKw ?? 0),
    generationPeakKw: Math.max(result.generationPeakKw, point.generationPowerKw ?? 0)
  }), { importKwh: 0, exportKwh: 0, peakDemandKw: 0, generationPeakKw: 0 });
  const anomalies = detectConsumptionAnomalies(series, input.granularity === "hour" ? 24 : 7);
  return {
    granularity: input.granularity,
    unit: "kWh",
    demandUnit: "kW",
    currency: input.tariffRate === undefined ? null : "INR",
    tariffRatePerKwh: input.tariffRate ?? null,
    estimatedImportCost: input.tariffRate === undefined ? null : Number((totals.importKwh * input.tariffRate).toFixed(2)),
    totals: {
      importKwh: Number(totals.importKwh.toFixed(3)),
      exportKwh: Number(totals.exportKwh.toFixed(3)),
      peakDemandKw: Number(totals.peakDemandKw.toFixed(3)),
      generationPeakKw: Number(totals.generationPeakKw.toFixed(3))
    },
    series,
    anomalies
  };
}
