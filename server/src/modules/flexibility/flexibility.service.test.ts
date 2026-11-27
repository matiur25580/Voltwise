import { describe, expect, it } from "vitest";
import { simulateBatteryDispatch } from "./flexibility.service.js";
describe("battery dispatch simulation", () => {
  it("clips peaks while respecting power and usable-energy limits", () => {
    const result = simulateBatteryDispatch({ baselineLoadKw: [40, 90, 100, 45], intervalMinutes: 60, targetDemandKw: 70, batteryCapacityKwh: 30, maxDischargeKw: 20, initialSocPercent: 80, reserveSocPercent: 20 });
    expect(result.schedule.map((item) => item.recommendedDischargeKw)).toEqual([0, 20, 10, 0]);
    expect(result.summary.baselinePeakKw).toBe(100); expect(result.summary.optimizedPeakKw).toBe(80); expect(result.summary.avoidedEnergyKwh).toBe(30);
  });
  it("preserves reserve state of charge", () => {
    const result = simulateBatteryDispatch({ baselineLoadKw: [100, 100], intervalMinutes: 60, targetDemandKw: 50, batteryCapacityKwh: 10, maxDischargeKw: 50, initialSocPercent: 40, reserveSocPercent: 30 });
    expect(result.schedule[0]?.recommendedDischargeKw).toBe(1); expect(result.schedule[1]?.recommendedDischargeKw).toBe(0); expect(result.schedule[1]?.remainingEnergyKwh).toBe(0);
  });
  it("estimates cost only with matching tariff assumptions", () => {
    const result = simulateBatteryDispatch({ baselineLoadKw: [80], intervalMinutes: 30, targetDemandKw: 60, batteryCapacityKwh: 20, maxDischargeKw: 30, initialSocPercent: 80, reserveSocPercent: 20, tariffRatesPerKwh: [10] });
    expect(result.summary.avoidedEnergyKwh).toBe(10); expect(result.summary.estimatedCostAvoidedInr).toBe(100);
  });
});
