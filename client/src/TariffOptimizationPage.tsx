import {useCallback,useEffect,useState,type FormEvent} from "react";
import {BatteryCharging,Check,Clock3,Play,RefreshCw,ShieldCheck,X} from "lucide-react";
import {useAuth} from "./auth/AuthContext";
type Battery={_id:string;name:string;assetTag:string};
type Schedule={index:number;tariffRateInrPerKwh:number;action:"charge"|"discharge"|"hold";powerKw:number;stateOfChargePercent:number;gridCostInr:number};
type Plan={_id:string;name:string;status:"proposed"|"approved"|"rejected";summary:{estimatedArbitrageMarginInr:number;chargedEnergyKwh:number;dischargedEnergyKwh:number};schedule:Schedule[];createdAt:string;decisionNote?:string};
const fmt=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2});
export default function TariffOptimizationPage(){
 const {apiFetch}=useAuth();const [batteries,setBatteries]=useState<Battery[]>([]);const [plans,setPlans]=useState<Plan[]>([]);
 const [batteryId,setBatteryId]=useState("");const [name,setName]=useState("Time-of-use battery schedule");
 const [rates,setRates]=useState("3, 4, 5, 6, 12, 14, 13, 8");const [interval,setInterval]=useState("60");
 const [charge,setCharge]=useState("5");const [discharge,setDischarge]=useState("5");const [soc,setSoc]=useState("50");
 const [minimum,setMinimum]=useState("15");const [maximum,setMaximum]=useState("90");const [efficiency,setEfficiency]=useState("90");
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{
  const [ar,pr]=await Promise.all([apiFetch("/api/v1/assets?type=battery&status=active&limit=100"),apiFetch("/api/v1/flexibility/tariff-optimizations")]);
  const [ab,pb]=await Promise.all([ar.json(),pr.json()]) as [{data?:Battery[];error?:{message?:string}},{data?:Plan[];error?:{message?:string}}];
  if(!ar.ok)throw new Error(ab.error?.message??"Battery assets unavailable.");if(!pr.ok)throw new Error(pb.error?.message??"Tariff scenarios unavailable.");
  const list=ab.data??[];setBatteries(list);setPlans(pb.data??[]);if(!batteryId&&list[0])setBatteryId(list[0]._id);
 }catch(e){setError(e instanceof Error?e.message:"Could not load tariff workspace.");}finally{setLoading(false);}},[apiFetch,batteryId]);
 useEffect(()=>{void load();},[load]);
 const create=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError("");setSuccess("");
  const tariffRatesInrPerKwh=rates.split(",").map(x=>Number(x.trim()));
  if(!tariffRatesInrPerKwh.length||tariffRatesInrPerKwh.some(x=>!Number.isFinite(x)||x<0)){setError("Enter comma-separated non-negative INR/kWh rates.");setSaving(false);return;}
  try{const r=await apiFetch("/api/v1/flexibility/tariff-optimizations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,batteryAssetIds:[batteryId],intervalMinutes:Number(interval),tariffRatesInrPerKwh,maxChargeKw:Number(charge),maxDischargeKw:Number(discharge),initialSocPercent:Number(soc),minimumSocPercent:Number(minimum),maximumSocPercent:Number(maximum),roundTripEfficiencyPercent:Number(efficiency)})});
   const b=await r.json() as {error?:{message?:string}};if(!r.ok)throw new Error(b.error?.message??"Optimization failed.");
   setSuccess("Tariff schedule saved as a proposal. It does not control physical equipment.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Optimization failed.");}finally{setSaving(false);}
 };
 const decide=async(id:string,decision:"approve"|"reject")=>{setError("");setSuccess("");try{
  const r=await apiFetch(`/api/v1/flexibility/tariff-optimizations/${id}/decision`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({decision,note:"Reviewed in Voltwise tariff workspace."})});
  const b=await r.json() as {error?:{message?:string}};if(!r.ok)throw new Error(b.error?.message??"Decision failed.");setSuccess(`Tariff proposal ${decision}d. No dispatch command was sent.`);await load();
 }catch(e){setError(e instanceof Error?e.message:"Decision failed.");}};
 return <div className="flexibility-page">
  <div className="page-heading flexibility-heading"><div><div className="eyebrow"><span className="live-dot"/> FLEXIBILITY & OPTIMIZATION <span className="sample-tag">SCENARIO ONLY</span></div><h1>Time-of-use scheduling</h1><p>Model battery charging in lower-price windows and discharge in higher-price windows.</p></div><button className="export-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
  {error&&<div className="auth-error registry-error">{error}</div>}{success&&<div className="registry-success">{success}</div>}
  <div className="flexibility-layout">
   <section className="panel"><div className="panel-heading"><div><h2>Tariff scenario</h2><p>Provide an ordered tariff series in INR/kWh</p></div><span className="metric-icon"><BatteryCharging size={17}/></span></div>
    <form className="registry-form flexibility-form" onSubmit={e=>void create(e)}>
     <label>Scenario name<input value={name} onChange={e=>setName(e.target.value)} required minLength={3}/></label>
     <label>Battery asset<select value={batteryId} onChange={e=>setBatteryId(e.target.value)} required><option value="">Select battery</option>{batteries.map(b=><option key={b._id} value={b._id}>{b.name} · {b.assetTag}</option>)}</select></label>
     <label className="profile-field">Tariff rates (comma-separated, INR/kWh)<textarea rows={3} value={rates} onChange={e=>setRates(e.target.value)} required/></label>
     <label>Interval<select value={interval} onChange={e=>setInterval(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label>
     <label>Maximum charge (kW)<input type="number" min="0.1" step="0.1" value={charge} onChange={e=>setCharge(e.target.value)}/></label>
     <label>Maximum discharge (kW)<input type="number" min="0.1" step="0.1" value={discharge} onChange={e=>setDischarge(e.target.value)}/></label>
     <label>Initial SoC (%)<input type="number" min="0" max="100" value={soc} onChange={e=>setSoc(e.target.value)}/></label>
     <label>Minimum SoC (%)<input type="number" min="0" max="95" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
     <label>Maximum SoC (%)<input type="number" min="5" max="100" value={maximum} onChange={e=>setMaximum(e.target.value)}/></label>
     <label>Round-trip efficiency (%)<input type="number" min="50" max="100" value={efficiency} onChange={e=>setEfficiency(e.target.value)}/></label>
     <button className="auth-submit" type="submit" disabled={saving||loading||!batteryId}><Play size={15}/>{saving?"Optimizing…":"Generate tariff schedule"}</button>
    </form>
    {!loading&&!batteries.length&&<p className="flexibility-help">Register an active battery with capacity in kWh or MWh before creating a schedule.</p>}
    <p className="flexibility-help">The schedule uses operator-provided tariff and SoC assumptions. It is a heuristic proposal, not a verified optimal dispatch plan.</p>
   </section>
   <section className="panel"><div className="panel-heading"><div><h2>Tariff proposals</h2><p>Review modeled charging and discharging intervals</p></div><span className="metric-icon"><ShieldCheck size={17}/></span></div>
    {loading?<div className="registry-empty">Loading proposals…</div>:!plans.length?<div className="registry-empty"><Clock3 size={20}/> No tariff scenarios yet.</div>:<div className="flexibility-plans">{plans.map(p=><article className="flexibility-plan" key={p._id}>
     <div className="flexibility-plan-top"><div><strong>{p.name}</strong><small>{new Date(p.createdAt).toLocaleString()}</small></div><span className={`plan-status ${p.status}`}>{p.status}</span></div>
     <div className="flexibility-kpis"><div><small>Indicative arbitrage margin</small><strong>₹{fmt(p.summary.estimatedArbitrageMarginInr)}</strong></div><div><small>Grid charge energy</small><strong>{fmt(p.summary.chargedEnergyKwh)} kWh</strong></div><div><small>Battery discharge</small><strong>{fmt(p.summary.dischargedEnergyKwh)} kWh</strong></div></div>
     <div className="flexibility-schedule">{p.schedule.map(s=><div key={s.index}><span>Interval {s.index+1}</span><strong>₹{fmt(s.tariffRateInrPerKwh)}/kWh</strong><span>{s.action} · {fmt(s.powerKw)} kW</span><b>{fmt(s.stateOfChargePercent)}% SoC</b></div>)}</div>
     {p.status==="proposed"&&<div className="flexibility-actions"><button className="approve-button" onClick={()=>void decide(p._id,"approve")}><Check size={14}/> Approve</button><button className="reject-button" onClick={()=>void decide(p._id,"reject")}><X size={14}/> Reject</button></div>}
     {p.decisionNote&&<p className="flexibility-help">Decision note: {p.decisionNote}</p>}
    </article>)}</div>}
   </section>
  </div>
 </div>;
}
