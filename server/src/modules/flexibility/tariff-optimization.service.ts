export type TariffOptimizationInput = {
 tariffRatesInrPerKwh:number[]; intervalMinutes:number; batteryCapacityKwh:number;
 maxChargeKw:number; maxDischargeKw:number; initialSocPercent:number;
 minimumSocPercent:number; maximumSocPercent:number; roundTripEfficiencyPercent:number;
};
export function optimizeTimeOfUseSchedule(input:TariffOptimizationInput) {
 const hours=input.intervalMinutes/60, efficiency=Math.sqrt(input.roundTripEfficiencyPercent/100);
 let energy=input.batteryCapacityKwh*input.initialSocPercent/100;
 const minEnergy=input.batteryCapacityKwh*input.minimumSocPercent/100;
 const maxEnergy=input.batteryCapacityKwh*input.maximumSocPercent/100;
 const sorted=input.tariffRatesInrPerKwh.map((rate,index)=>({rate,index})).sort((a,b)=>a.rate-b.rate);
 const low=sorted[Math.floor((sorted.length-1)*0.25)]?.rate ?? 0;
 const high=sorted[Math.ceil((sorted.length-1)*0.75)]?.rate ?? low;
 const threshold=(low+high)/2;
 const schedule=input.tariffRatesInrPerKwh.map((rate,index)=>{\n  const hasLaterPeak=input.tariffRatesInrPerKwh.slice(index+1).some(futureRate=>futureRate>threshold);
  let action:"charge"|"discharge"|"hold"="hold",powerKw=0,energyChangeKwh=0;
  if(rate<=threshold && hasLaterPeak && energy<maxEnergy){
   powerKw=Math.min(input.maxChargeKw,(maxEnergy-energy)/(hours*efficiency));
   energyChangeKwh=powerKw*hours*efficiency;
   if(powerKw>0){action="charge";energy+=energyChangeKwh;}
  } else if(rate>threshold && energy>minEnergy){
   powerKw=Math.min(input.maxDischargeKw,(energy-minEnergy)*efficiency/hours);
   energyChangeKwh=powerKw*hours;
   if(powerKw>0){action="discharge";energy-=energyChangeKwh/efficiency;}
  }
  const gridCostInr=(action==="charge"?powerKw*hours:action==="discharge"?-powerKw*hours:0)*rate;
  return {index,tariffRateInrPerKwh:rate,action,powerKw:Number(powerKw.toFixed(3)),energyChangeKwh:Number(energyChangeKwh.toFixed(3)),stateOfChargePercent:Number((energy/input.batteryCapacityKwh*100).toFixed(2)),gridCostInr:Number(gridCostInr.toFixed(2))};
 });
 const totalGridCostInr=schedule.reduce((sum,item)=>sum+item.gridCostInr,0);
 const chargedEnergyKwh=schedule.filter(x=>x.action==="charge").reduce((sum,x)=>sum+x.powerKw*hours,0);
 const dischargedEnergyKwh=schedule.filter(x=>x.action==="discharge").reduce((sum,x)=>sum+x.powerKw*hours,0);
 return {schedule,summary:{totalGridCostInr:Number(totalGridCostInr.toFixed(2)),estimatedArbitrageMarginInr:Number(Math.max(0,-totalGridCostInr).toFixed(2)),chargedEnergyKwh:Number(chargedEnergyKwh.toFixed(3)),dischargedEnergyKwh:Number(dischargedEnergyKwh.toFixed(3))}};
}
