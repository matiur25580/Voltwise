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

export default function App() {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Zap size={20} fill="currentColor"/></div><div><strong>voltwise</strong><small>ENERGY INTELLIGENCE</small></div></div>
      <div className="workspace"><div className="workspace-icon">N</div><div><strong>Northstar Industries</strong><small>Enterprise workspace</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <a className="nav-item active" href="#"><Gauge size={17}/> Overview</a>
        <a className="nav-item" href="#"><Building2 size={17}/> Facilities</a>
        <a className="nav-item" href="#"><Activity size={17}/> Energy analytics</a>
        <a className="nav-item" href="#"><BatteryCharging size={17}/> Energy assets</a>
        <a className="nav-item" href="#"><PlugZap size={17}/> Demand response</a>
        <a className="nav-item" href="#"><Leaf size={17}/> Sustainability</a>
      </nav>
      <div className="nav-label">MANAGE</div>
      <nav>
        <a className="nav-item" href="#"><ShieldCheck size={17}/> Alerts & incidents <span className="nav-count">3</span></a>
        <a className="nav-item" href="#"><Settings2 size={17}/> Settings</a>
      </nav>
      <div className="sidebar-bottom"><div className="support-card"><CircleHelp size={17}/><div><strong>Need a hand?</strong><small>Visit the product guide</small></div></div><div className="user-row"><div className="avatar">AM</div><div><strong>Alex Morgan</strong><small>Energy administrator</small></div><MoreHorizontal size={18}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="mobile-brand"><Menu size={19}/> voltwise</div><div className="breadcrumbs">Workspace <span>/</span> <strong>Overview</strong></div><div className="top-actions"><div className="search-box"><Search size={15}/><span>Search anything...</span><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Help"><CircleHelp size={18}/></button><div className="avatar small">AM</div></div></header>
      <div className="content">
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
      </div>
    </main>
  </div>;
}
