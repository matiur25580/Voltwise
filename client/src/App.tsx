import { useState } from "react";
import { useAuth } from "./auth/AuthContext";
import FacilitiesPage from "./FacilitiesPage";
import TelemetryPage from "./TelemetryPage";
import AnalyticsPage from "./AnalyticsPage";
import FlexibilityPage from "./FlexibilityPage";
import TariffOptimizationPage from "./TariffOptimizationPage";
import AuthScreen from "./auth/AuthScreen";
import { Activity, ArrowDownRight, ArrowUpRight, BatteryCharging, Building2, ChevronDown, CircleHelp, Command, Download, Gauge, Leaf, Menu, MoreHorizontal, PlugZap, RadioTower, Search, Settings2, ShieldCheck, Sun, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const usage = [
  { time: "00:00", actual: 32, baseline: 35 }, { time: "03:00", actual: 25, baseline: 29 },
  { time: "06:00", actual: 38, baseline: 36 }, { time: "09:00", actual: 61, baseline: 55 },
  { time: "12:00", actual: 78, baseline: 70 }, { time: "15:00", actual: 68, baseline: 66 },
  { time: "18:00", actual: 84, baseline: 75 }, { time: "21:00", actual: 52, baseline: 56 }
];

const facilities = [
  { name: "North manufacturing campus", location: "Pune, Maharashtra", usage: "4,820 kWh", change: "+4.2%", state: "Attention", icon: Building2 },
  { name: "West distribution hub", location: "Mumbai, Maharashtra", usage: "2,640 kWh", change: "-8.1%", state: "Healthy", icon: RadioTower },
  { name: "Solar generation site", location: "Nashik, Maharashtra", usage: "1,920 kWh", change: "+12.6%", state: "Healthy", icon: Sun }
];

function MetricCard({ label, value, note, trend, icon: Icon }: { label: string; value: string; note: string; trend: "up" | "down"; icon: typeof Zap }) {
  return <article className="metric-card">
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-foot"><span className={trend === "down" ? "trend positive" : "trend"}>{trend === "down" ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>} {note}</span><span>vs. previous period</span></div>
  </article>;
}

function Dashboard() {
  const { user, organization, logout } = useAuth();
  const [activePage, setActivePage] = useState<"overview" | "facilities" | "assets" | "telemetry" | "analytics" | "flexibility" | "tariff">("overview");
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Zap size={20} fill="currentColor"/></div><div><strong>voltwise</strong><small>ENERGY INTELLIGENCE</small></div></div>
      <div className="workspace"><div className="workspace-icon">N</div><div><strong>{organization?.name ?? "Your organization"}</strong><small>{organization?.role ?? "Enterprise workspace"}</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <button className={`nav-item ${activePage === "overview" ? "active" : ""}`} onClick={() => setActivePage("overview")}><Gauge size={17}/> Overview</button>
        <button className={`nav-item ${activePage === "facilities" ? "active" : ""}`} onClick={() => setActivePage("facilities")}><Building2 size={17}/> Facilities</button>
        <button className={`nav-item ${activePage === "telemetry" ? "active" : ""}`} onClick={() => setActivePage("telemetry")}><RadioTower size={17}/> Live telemetry</button>
        <button className={`nav-item ${activePage === "analytics" ? "active" : ""}`} onClick={() => setActivePage("analytics")}><Activity size={17}/> Energy analytics</button>
        <button className={`nav-item ${activePage === "assets" ? "active" : ""}`} onClick={() => setActivePage("assets")}><BatteryCharging size={17}/> Energy assets</button>
        <button className={`nav-item ${activePage === "flexibility" ? "active" : ""}`} onClick={() => setActivePage("flexibility")}><PlugZap size={17}/> Demand response</button>\n        <button className={`nav-item ${activePage === "tariff" ? "active" : ""}`} onClick={() => setActivePage("tariff")}><BatteryCharging size={17}/> Tariff optimization</button>
        <button className="nav-item" onClick={() => setActivePage("overview")}><Leaf size={17}/> Sustainability</button>
      </nav>
      <div className="nav-label">MANAGE</div>
      <nav>
        <button className="nav-item" onClick={() => setActivePage("overview")}><ShieldCheck size={17}/> Alerts & incidents <span className="nav-count">3</span></button>
        <button className="nav-item" onClick={() => setActivePage("overview")}><Settings2 size={17}/> Settings</button>
      </nav>
      <div className="sidebar-bottom"><div className="support-card"><CircleHelp size={17}/><div><strong>Need a hand?</strong><small>Visit the product guide</small></div></div><div className="user-row"><div className="avatar">U</div><div><strong>{user?.name ?? "Workspace member"}</strong><small>{user?.email ?? "Signed in"}</small></div><button className="logout-button" onClick={() => void logout()}>Sign out</button></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="mobile-brand"><Menu size={19}/> voltwise</div><div className="breadcrumbs">Workspace <span>/</span> <strong>Overview</strong></div><div className="top-actions"><div className="search-box"><Search size={15}/><span>Search anything...</span><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Help"><CircleHelp size={18}/></button><div className="avatar small">AM</div></div></header>
      <div className="content">
        {activePage === "tariff" ? <TariffOptimizationPage/> : activePage === "flexibility" ? <FlexibilityPage/> : activePage === "analytics" ? <AnalyticsPage/> : activePage === "telemetry" ? <TelemetryPage/> : activePage === "facilities" ? <FacilitiesPage mode="facilities"/> : activePage === "assets" ? <FacilitiesPage mode="assets"/> : <>
        <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> ENERGY OPERATIONS <span className="sample-tag">SAMPLE WORKSPACE</span></div><h1>Good morning, Alex <span>✳</span></h1><p>Here’s what’s happening across your energy portfolio today.</p></div><button className="export-button"><Download size={15}/> Export report</button></div>
        <div className="notice"><div className="notice-icon"><Activity size={17}/></div><div><strong>Demonstration environment</strong><p>Metrics and facilities shown here are sample data. Connect verified meters and assets to display live operational information.</p></div><button aria-label="Dismiss notice">×</button></div>
        <section className="metric-grid">
          <MetricCard label="Energy consumed" value="9,380 kWh" note="6.4%" trend="up" icon={Zap}/>
          <MetricCard label="Energy expenditure" value="₹ 84,420" note="3.2%" trend="down" icon={Activity}/>
          <MetricCard label="Renewable contribution" value="38.6%" note="5.8%" trend="up" icon={Sun}/>
          <MetricCard label="Portfolio efficiency" value="92.4 / 100" note="2.1%" trend="up" icon={Gauge}/>
        </section>
        <section className="dashboard-grid">
          <article className="panel chart-panel"><div className="panel-heading"><div><h2>Energy consumption</h2><p>Portfolio demand · Today</p></div><button className="select-button">Today <ChevronDown size={14}/></button></div><div className="chart-legend"><span><i className="legend-blue"/> Actual consumption</span><span><i className="legend-muted"/> Baseline</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={usage} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f8cff" stopOpacity={0.24}/><stop offset="95%" stopColor="#4f8cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#26354a" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#8291a8", fontSize: 11 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#8291a8", fontSize: 11 }}/><Tooltip contentStyle={{ background: "#111e30", border: "1px solid #2a3b53", borderRadius: 10, color: "#e8eef8" }}/><Area type="monotone" dataKey="baseline" stroke="#6c7b91" strokeDasharray="5 5" strokeWidth={1.5} fill="transparent"/><Area type="monotone" dataKey="actual" stroke="#5b9bff" strokeWidth={2.5} fill="url(#actualFill)"/></AreaChart></ResponsiveContainer></div><div className="chart-caption"><span>Peak demand <strong>84 kW</strong></span><span>Daily baseline <strong>72 kW</strong></span><span>Data interval <strong>3 hours</strong></span></div></article>
          <article className="panel insight-panel"><div className="panel-heading"><div><h2>Intelligence brief</h2><p>Illustrative operational signals</p></div><span className="ai-chip"><Command size={12}/> INSIGHTS</span></div><div className="insight-item"><div className="insight-symbol amber"><Zap size={16}/></div><div><strong>Evening peak is trending higher</strong><p>Sample demand is 12% above the illustrative baseline. Review flexible loads before the evening window.</p><span className="severity">REVIEW SUGGESTED</span></div></div><div className="insight-item"><div className="insight-symbol green"><Sun size={16}/></div><div><strong>Solar contribution improved</strong><p>Renewable share is up 5.8% against the previous sample period.</p><span className="severity calm">POSITIVE TREND</span></div></div><div className="insight-item"><div className="insight-symbol blue"><BatteryCharging size={16}/></div><div><strong>Storage opportunity identified</strong><p>A simulation could evaluate shifting flexible demand to lower-cost periods.</p><span className="severity info">SIMULATION ONLY</span></div></div><button className="text-link">Explore energy intelligence <ArrowUpRight size={14}/></button></article>
        </section>
        <section className="panel facilities-panel"><div className="panel-heading"><div><h2>Facility performance</h2><p>Sample portfolio snapshot</p></div><button className="text-link">View all facilities <ArrowUpRight size={14}/></button></div><div className="table-wrap"><table><thead><tr><th>FACILITY</th><th>ENERGY CONSUMPTION</th><th>CHANGE</th><th>STATUS</th><th></th></tr></thead><tbody>{facilities.map((facility) => <tr key={facility.name}><td><div className="facility-cell"><span className="facility-icon"><facility.icon size={17}/></span><div><strong>{facility.name}</strong><small>{facility.location}</small></div></div></td><td className="table-value">{facility.usage}</td><td className={facility.change.startsWith("-") ? "positive-text" : "warning-text"}>{facility.change}</td><td><span className={facility.state === "Healthy" ? "status healthy" : "status attention"}><i/>{facility.state}</span></td><td><MoreHorizontal size={18} color="#71819a"/></td></tr>)}</tbody></table></div></section>
        <footer><span>VOLTWISE PLATFORM <b>·</b> FOUNDATION PREVIEW</span><span>Designed for operational clarity <Zap size={12}/></span></footer>
        </>}
      </div>
    </main>
  </div>;
}


export default function App() {
  const { accessToken, loading } = useAuth();
  if (loading) return <div className="auth-loading"><div className="brand-mark"><Zap size={20} fill="currentColor"/></div><span>Securing your workspace…</span></div>;
  return accessToken ? <Dashboard /> : <AuthScreen />;
}
