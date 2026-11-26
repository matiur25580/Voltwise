import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart3, CalendarDays, Download, RefreshCw, TrendingUp, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "./auth/AuthContext";

type EnergyPoint = {
  bucket: string; importKwh: number; exportKwh: number;
  averageDemandKw: number | null; peakDemandKw: number | null; generationPowerKw: number | null;
};
type AnalyticsResponse = {
  data: {
    granularity: "hour" | "day"; unit: string; demandUnit: string;
    currency: string | null; tariffRatePerKwh: number | null; estimatedImportCost: number | null;
    totals: { importKwh: number; exportKwh: number; peakDemandKw: number; generationPeakKw: number };
    series: EnergyPoint[];
    anomalies: { bucket: string; observedKwh: number; baselineKwh: number; deviationPercent: number; severity: "warning" | "high"; explanation: string }[];
  };
  range: { from: string; to: string };
};

const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const label = (bucket: string, granularity: "hour" | "day") => {
  const date = new Date(bucket);
  return granularity === "hour" ? date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" }) : date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function AnalyticsPage() {
  const { apiFetch } = useAuth();
  const [result, setResult] = useState<AnalyticsResponse["data"] | null>(null);
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [granularity, setGranularity] = useState<"day" | "hour">("day");
  const [tariffRate, setTariffRate] = useState("8.5");
  const [includeTariff, setIncludeTariff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from: new Date(from + "T00:00:00.000Z").toISOString(), to: new Date(to + "T23:59:59.999Z").toISOString(), granularity });
      if (includeTariff && tariffRate.trim()) params.set("tariffRate", tariffRate);
      const response = await apiFetch(`/api/v1/analytics/energy?${params}`);
      const body = await response.json() as AnalyticsResponse | { error?: { message?: string } };
      if (!response.ok || !("data" in body)) throw new Error(("error" in body ? body.error?.message : undefined) ?? "Energy analytics could not be loaded.");
      setResult(body.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Energy analytics could not be loaded."); }
    finally { setLoading(false); }
  }, [apiFetch, from, to, granularity, includeTariff, tariffRate]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    if (!result) return;
    const rows = [["bucket", "import_kwh", "export_kwh", "average_demand_kw", "peak_demand_kw", "generation_power_kw"],
      ...result.series.map((point) => [point.bucket, point.importKwh, point.exportKwh, point.averageDemandKw ?? "", point.peakDemandKw ?? "", point.generationPowerKw ?? ""])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "voltwise-energy-analytics.csv"; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="analytics-page">
    <div className="page-heading analytics-heading">
      <div><div className="eyebrow"><span className="live-dot"/> ENERGY INTELLIGENCE <span className="sample-tag">VERIFIED TELEMETRY</span></div>
        <h1>Energy analytics</h1><p>Consumption, demand, and export insights calculated from your organization's persisted meter readings.</p></div>
      <button className="export-button" onClick={exportCsv} disabled={!result?.series.length}><Download size={15}/> Export CSV</button>
    </div>
    <section className="panel analytics-filters">
      <label><CalendarDays size={14}/> From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)}/></label>
      <label><CalendarDays size={14}/> To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)}/></label>
      <label>Interval<select value={granularity} onChange={(event) => setGranularity(event.target.value as "day" | "hour")}><option value="day">Daily</option><option value="hour">Hourly</option></select></label>
      <label className="tariff-toggle"><input type="checkbox" checked={includeTariff} onChange={(event) => setIncludeTariff(event.target.checked)}/> Estimate import cost</label>
      {includeTariff && <label>Tariff (₹ / kWh)<input type="number" min="0" max="1000" step="0.01" value={tariffRate} onChange={(event) => setTariffRate(event.target.value)}/></label>}
      <button className="export-button" onClick={() => void load()} disabled={loading || !from || !to || (includeTariff && (!tariffRate || Number(tariffRate) < 0 || Number(tariffRate) > 1000))}><RefreshCw size={14}/> {loading ? "Loading…" : "Refresh"}</button>
    </section>
    {error && <div className="auth-error registry-error">{error}</div>}
    {loading && !result ? <div className="registry-empty">Calculating tenant-scoped energy metrics…</div> : result && <>
      <div className="registry-stats analytics-stats">
        <article className="metric-card"><div className="metric-top"><span>Imported energy</span><span className="metric-icon"><Zap size={17}/></span></div><div className="metric-value">{number(result.totals.importKwh)} kWh</div><div className="metric-foot">Sum of energy_import readings</div></article>
        <article className="metric-card"><div className="metric-top"><span>Exported energy</span><span className="metric-icon"><Activity size={17}/></span></div><div className="metric-value">{number(result.totals.exportKwh)} kWh</div><div className="metric-foot">Sum of energy_export readings</div></article>
        <article className="metric-card"><div className="metric-top"><span>Peak measured demand</span><span className="metric-icon"><TrendingUp size={17}/></span></div><div className="metric-value">{number(result.totals.peakDemandKw)} kW</div><div className="metric-foot">Maximum active_power sample</div></article>
        <article className="metric-card"><div className="metric-top"><span>Estimated import cost</span><span className="metric-icon"><BarChart3 size={17}/></span></div><div className="metric-value">{result.estimatedImportCost === null ? "Not configured" : `₹${number(result.estimatedImportCost)}`}</div><div className="metric-foot">{result.tariffRatePerKwh === null ? "Provide a tariff assumption to estimate" : `At ₹${number(result.tariffRatePerKwh)} / kWh · indicative only`}</div></article>
      </div>
      <section className="panel analytics-chart">
        <div className="panel-heading"><div><h2>Energy profile</h2><p>Imported and exported energy · {result.granularity === "day" ? "daily" : "hourly"} buckets (UTC)</p></div><span className="metric-icon"><Activity size={17}/></span></div>
        {result.series.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={result.series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#26354a" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="bucket" tickFormatter={(value) => label(value, result.granularity)} axisLine={false} tickLine={false} tick={{ fill: "#8291a8", fontSize: 10 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#8291a8", fontSize: 10 }}/><Tooltip labelFormatter={(value) => label(String(value), result.granularity)} contentStyle={{ background: "#111e30", border: "1px solid #2a3b53", borderRadius: 10, color: "#e8eef8" }}/><Area type="monotone" dataKey="importKwh" name="Imported kWh" stroke="#5b9bff" strokeWidth={2.5} fill="#4f8cff" fillOpacity={0.14}/><Area type="monotone" dataKey="exportKwh" name="Exported kWh" stroke="#55c99b" strokeWidth={2} fill="#55c99b" fillOpacity={0.1}/></AreaChart></ResponsiveContainer></div> : <div className="registry-empty"><Activity size={22}/> No energy_import or energy_export readings exist in this range.</div>}
      </section>
      <section className="analytics-bottom">
        <article className="panel"><div className="panel-heading"><div><h2>Consumption anomalies</h2><p>Explainable increases versus preceding comparable buckets</p></div><span className="metric-icon"><AlertTriangle size={17}/></span></div>
          {result.anomalies.length ? <div className="anomaly-list">{result.anomalies.map((item) => <div className="anomaly-row" key={item.bucket}><span className={`anomaly-severity ${item.severity}`}/><div><strong>{label(item.bucket, result.granularity)} · +{number(item.deviationPercent)}%</strong><p>{item.explanation}</p><small>{number(item.observedKwh)} kWh observed · {number(item.baselineKwh)} kWh baseline</small></div></div>)}</div> : <div className="registry-empty"><Activity size={20}/> No material increases detected with sufficient baseline data.</div>}
        </article>
        <article className="panel"><div className="panel-heading"><div><h2>Data coverage</h2><p>Interpretation and provenance</p></div><span className="metric-icon"><BarChart3 size={17}/></span></div>
          <div className="coverage-list"><div><span>Telemetry buckets</span><strong>{result.series.length}</strong></div><div><span>Generation peak</span><strong>{number(result.totals.generationPeakKw)} kW</strong></div><div><span>Export/import ratio</span><strong>{result.totals.importKwh > 0 ? `${number(result.totals.exportKwh / result.totals.importKwh * 100)}%` : "—"}</strong></div></div>
          <p className="analytics-disclaimer">Cost is a simple user-supplied flat-rate estimate, not a utility bill. Anomaly flags are heuristic screening signals, not proof of equipment faults. All time buckets use UTC. Only persisted telemetry is included; no sample dashboard metrics are mixed in.</p>
        </article>
      </section>
    </>}
  </div>;
}
