import {describe,expect,it} from "vitest";
import {optimizeTimeOfUseSchedule} from "./tariff-optimization.service.js";
describe("time-of-use battery schedule",()=>{
 const base={intervalMinutes:60,batteryCapacityKwh:20,maxChargeKw:5,maxDischargeKw:5,initialSocPercent:20,minimumSocPercent:10,maximumSocPercent:90,roundTripEfficiencyPercent:90};
 it("respects power and state-of-charge bounds",()=>{
  const r=optimizeTimeOfUseSchedule({...base,tariffRatesInrPerKwh:[3,4,12,14]});
  expect(r.schedule.every(x=>x.powerKw<=5)).toBe(true);
  expect(r.schedule.every(x=>x.stateOfChargePercent>=10&&x.stateOfChargePercent<=90)).toBe(true);
 });
 it("holds when tariff is flat",()=>{
  const r=optimizeTimeOfUseSchedule({...base,tariffRatesInrPerKwh:[8,8,8,8]});
  expect(r.schedule.every(x=>x.action==="hold")).toBe(true);
 });
 it("never reports negative savings as positive",()=>{
  const r=optimizeTimeOfUseSchedule({...base,tariffRatesInrPerKwh:[2,2,20,20]});
  expect(r.summary.estimatedArbitrageMarginInr).toBeGreaterThanOrEqual(0);
 });
});
