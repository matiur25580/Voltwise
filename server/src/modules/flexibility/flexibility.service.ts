export type DispatchInput = {
  baselineLoadKw: number[]; intervalMinutes: number; targetDemandKw: number;
  batteryCapacityKwh: number; maxDischargeKw: number; initialSocPercent: number;
  reserveSocPercent: number; tariffRatesPerKwh?: number[];
};
export function simulateBatteryDispatch(input: DispatchInput) {
  const intervalHours = input.intervalMinutes / 60;
  let availableEnergyKwh = input.batteryCapacityKwh * (input.initialSocPercent - input.reserveSocPercent) / 100;
  const schedule = input.baselineLoadKw.map((loadKw, index) => {
    const excessKw = Math.max(0, loadKw - input.targetDemandKw);
    const dischargeKw = Math.min(excessKw, input.maxDischargeKw, availableEnergyKwh / intervalHours);
    const avoidedEnergyKwh = dischargeKw * intervalHours;
    availableEnergyKwh = Math.max(0, availableEnergyKwh - avoidedEnergyKwh);
    return {
      index, baselineLoadKw: Number(loadKw.toFixed(3)), recommendedDischargeKw: Number(dischargeKw.toFixed(3)),
      optimizedLoadKw: Number(Math.max(0, loadKw - dischargeKw).toFixed(3)),
      remainingEnergyKwh: Number(availableEnergyKwh.toFixed(3)), avoidedEnergyKwh: Number(avoidedEnergyKwh.toFixed(3))
    };
  });
  const baselinePeakKw = Math.max(0, ...input.baselineLoadKw);
  const optimizedPeakKw = Math.max(0, ...schedule.map((item) => item.optimizedLoadKw));
  const avoidedEnergyKwh = schedule.reduce((sum, item) => sum + item.avoidedEnergyKwh, 0);
  const estimatedCostAvoidedInr = input.tariffRatesPerKwh?.length
    ? schedule.reduce((sum, item, index) => sum + item.avoidedEnergyKwh * (input.tariffRatesPerKwh?.[index] ?? 0), 0)
    : null;
  return { schedule, summary: {
    baselinePeakKw: Number(baselinePeakKw.toFixed(3)), optimizedPeakKw: Number(optimizedPeakKw.toFixed(3)),
    avoidedEnergyKwh: Number(avoidedEnergyKwh.toFixed(3)),
    estimatedCostAvoidedInr: estimatedCostAvoidedInr === null ? null : Number(estimatedCostAvoidedInr.toFixed(2))
  } };
}
