import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BatteryCharging, Check, Clock3, Play, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useAuth } from "./auth/AuthContext";

type BatteryAsset = { _id: string; name: string; assetTag: string; capacity?: { value?: number; unit?: string } };
type Plan = {
  _id: string; name: string; status: "proposed" | "approved" | "rejected";
  summary: { baselinePeakKw: number; optimizedPeakKw: number; avoidedEnergyKwh: number; estimatedCostAvoidedInr: number | null };
  schedule: { index: number; baselineLoadKw: number; recommendedDischargeKw: number; optimizedLoadKw: number; remainingEnergyKwh: number }[];
  decisionNote?: string; createdAt: string;
};
const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function FlexibilityPage() {
  const { apiFetch } = useAuth();
  const [batteries, setBatteries] = useState<BatteryAsset[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [batteryId, setBatteryId] = useState("");
  const [name, setName] = useState("Evening peak reduction");
  const [profile, setProfile] = useState("40, 90, 100, 45");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [target, setTarget] = useState("70");
  const [maxPower, setMaxPower] = useState("20");
  const [initialSoc, setInitialSoc] = useState("80");
  const [reserveSoc, setReserveSoc] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [assetResponse, planResponse] = await Promise.all([
        apiFetch("/api/v1/assets?type=battery&status=active&limit=100"),
        apiFetch("/api/v1/flexibility/simulations")
      ]);
      const [assetBody, planBody] = await Promise.all([assetResponse.json(), planResponse.json()]) as [
        { data?: BatteryAsset[]; error?: { message?: string } },
        { data?: Plan[]; error?: { message?: string } }
      ];
      if (!assetResponse.ok) throw new Error(assetBody.error?.message ?? "Battery assets could not be loaded.");
      if (!planResponse.ok) throw new Error(planBody.error?.message ?? "Optimization scenarios could not be loaded.");
      const list = assetBody.data ?? [];
      setBatteries(list); setPlans(planBody.data ?? []);
      if (!batteryId && list[0]) setBatteryId(list[0]._id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load flexibility workspace."); }
    finally { setLoading(false); }
  }, [apiFetch, batteryId]);

  useEffect(() => { void load(); }, [load]);

  const createSimulation = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const baselineLoadKw = profile.split(",").map((part) => Number(part.trim()));
    if (!baselineLoadKw.length || baselineLoadKw.some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Enter a comma-separated list of non-negative load values in kW."); setSaving(false); return;
    }
    try {
      const response = await apiFetch("/api/v1/flexibility/simulations", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, batteryAssetIds: [batteryId], baselineLoadKw, intervalMinutes: Number(intervalMinutes),
          targetDemandKw: Number(target), maxDischargeKw: Number(maxPower),
          initialSocPercent: Number(initialSoc), reserveSocPercent: Number(reserveSoc)
        })
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Simulation could not be created.");
      setSuccess("Scenario simulated and saved as a proposal. No physical equipment was controlled.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Simulation failed."); }
    finally { setSaving(false); }
  };

  const decide = async (planId: string, decision: "approve" | "reject") => {
    setError(""); setSuccess("");
    try {
      const response = await apiFetch(`/api/v1/flexibility/simulations/${planId}/decision`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, note: "Reviewed in Voltwise workspace." })
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Decision could not be saved.");
      setSuccess(`Scenario ${decision}d. Approval is recorded for governance; it does not dispatch a battery.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Decision failed."); }
  };

  return <div className="flexibility-page">
    <div className="page-heading flexibility-heading">
      <div><div className="eyebrow"><span className="live-dot"/> FLEXIBILITY & OPTIMIZATION <span className="sample-tag">SIMULATION ONLY</span></div>
        <h1>Demand response</h1><p>Evaluate battery peak shaving, review interval recommendations, and approve scenarios with an audit trail.</p></div>
      <button className="export-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button>
    </div>
    {error && <div className="auth-error registry-error">{error}</div>}
    {success && <div className="registry-success">{success}</div>}
    <div className="flexibility-layout">
      <section className="panel">
        <div className="panel-heading"><div><h2>New dispatch scenario</h2><p>Use a measured or operator-provided load profile</p></div><span className="metric-icon"><BatteryCharging size={17}/></span></div>
        <form className="registry-form flexibility-form" onSubmit={(event) => void createSimulation(event)}>
          <label>Scenario name<input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={120} required/></label>
          <label>Active battery asset<select value={batteryId} onChange={(event) => setBatteryId(event.target.value)} required><option value="">Select a battery</option>{batteries.map((battery) => <option key={battery._id} value={battery._id}>{battery.name} · {battery.assetTag}</option>)}</select></label>
          <label className="profile-field">Baseline load profile (kW, comma-separated)<textarea value={profile} onChange={(event) => setProfile(event.target.value)} rows={3} required/></label>
          <label>Interval<select value={intervalMinutes} onChange={(event) => setIntervalMinutes(event.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label>
          <label>Target demand (kW)<input type="number" min="0.1" step="0.1" value={target} onChange={(event) => setTarget(event.target.value)} required/></label>
          <label>Maximum discharge (kW)<input type="number" min="0.1" step="0.1" value={maxPower} onChange={(event) => setMaxPower(event.target.value)} required/></label>
          <label>Initial battery SoC (%)<input type="number" min="1" max="100" value={initialSoc} onChange={(event) => setInitialSoc(event.target.value)} required/></label>
          <label>Reserve battery SoC (%)<input type="number" min="0" max="95" value={reserveSoc} onChange={(event) => setReserveSoc(event.target.value)} required/></label>
          <button className="auth-submit" type="submit" disabled={saving || loading || !batteryId}><Play size={15}/>{saving ? "Simulating…" : "Run optimization simulation"}</button>
        </form>
        {!loading && !batteries.length && <p className="flexibility-help">No active battery assets found. Register a battery in Energy Assets and set its capacity in kWh or MWh first.</p>}
        <p className="flexibility-help">The battery capacity is read from the selected tenant asset. State of charge and load profile are scenario assumptions, not live telemetry.</p>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Optimization proposals</h2><p>Tenant-scoped scenarios and governance decisions</p></div><span className="metric-icon"><ShieldCheck size={17}/></span></div>
        {loading ? <div className="registry-empty">Loading scenarios…</div> : !plans.length ? <div className="registry-empty"><Clock3 size={20}/> No scenarios have been simulated yet.</div> :
          <div className="flexibility-plans">{plans.map((plan) => <article className="flexibility-plan" key={plan._id}>
            <div className="flexibility-plan-top"><div><strong>{plan.name}</strong><small>{new Date(plan.createdAt).toLocaleString()}</small></div><span className={`plan-status ${plan.status}`}>{plan.status}</span></div>
            <div className="flexibility-kpis"><div><small>Peak demand</small><strong>{fmt(plan.summary.baselinePeakKw)} → {fmt(plan.summary.optimizedPeakKw)} kW</strong></div><div><small>Energy shifted</small><strong>{fmt(plan.summary.avoidedEnergyKwh)} kWh</strong></div>{plan.summary.estimatedCostAvoidedInr !== null && <div><small>Indicative avoided cost</small><strong>₹{fmt(plan.summary.estimatedCostAvoidedInr)}</strong></div>}</div>
            <div className="flexibility-schedule">{plan.schedule.map((step) => <div key={step.index}><span>Interval {step.index + 1}</span><strong>{fmt(step.baselineLoadKw)} kW</strong><span>−{fmt(step.recommendedDischargeKw)} kW battery</span><b>{fmt(step.optimizedLoadKw)} kW</b></div>)}</div>
            {plan.status === "proposed" && <div className="flexibility-actions"><button className="approve-button" onClick={() => void decide(plan._id, "approve")}><Check size={14}/> Approve proposal</button><button className="reject-button" onClick={() => void decide(plan._id, "reject")}><X size={14}/> Reject</button></div>}
            {plan.decisionNote && <p className="flexibility-help">Decision note: {plan.decisionNote}</p>}
          </article>)}</div>}
      </section>
    </div>
  </div>;
}
