import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, ArrowLeft, BatteryCharging, Building2, LoaderCircle, Plus, RefreshCw, Search, Sun, Trash2, Zap } from "lucide-react";
import { useAuth } from "./auth/AuthContext";

type Facility = {
  _id: string; code: string; name: string; type: string; status: string;
  address?: { city?: string; region?: string; countryCode?: string };
  timezone?: string; assetCount?: number; childCount?: number;
};
type EnergyAsset = {
  _id: string; assetTag: string; name: string; type: string; status: string;
  manufacturer?: string; serialNumber?: string;
  facilityId: { _id: string; name: string; code: string } | string;
};
type ListResponse<T> = { data: T[]; pagination: { total: number; page: number; pages: number } };

const facilityTypes = ["campus", "office", "industrial", "warehouse", "retail", "data_center", "hospital", "other"];
const assetTypes = ["meter", "solar_pv", "inverter", "battery", "ev_charger", "hvac", "generator", "transformer", "other"];
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function FacilitiesPage({ mode }: { mode: "facilities" | "assets" }) {
  const { apiFetch } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [assets, setAssets] = useState<EnergyAsset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [facilityForm, setFacilityForm] = useState({ code: "", name: "", type: "office", city: "", countryCode: "IN", timezone: "Asia/Kolkata" });
  const [assetForm, setAssetForm] = useState({ facilityId: "", assetTag: "", name: "", type: "meter", manufacturer: "", serialNumber: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: "1", limit: "100" });
      if (query.trim()) params.set("q", query.trim());
      const [facilityResponse, assetResponse] = await Promise.all([
        apiFetch(`/api/v1/facilities?${params.toString()}`),
        apiFetch(`/api/v1/assets?page=1&limit=100${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`)
      ]);
      if (!facilityResponse.ok || !assetResponse.ok) throw new Error("Unable to load your organization’s facility registry.");
      const [facilityBody, assetBody] = await Promise.all([
        facilityResponse.json() as Promise<ListResponse<Facility>>,
        assetResponse.json() as Promise<ListResponse<EnergyAsset>>
      ]);
      setFacilities(facilityBody.data);
      setAssets(assetBody.data);
      setAssetForm((current) => ({ ...current, facilityId: current.facilityId || facilityBody.data[0]?._id || "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load facility data."); }
    finally { setLoading(false); }
  }, [apiFetch, query]);

  useEffect(() => { void load(); }, [load]);

  const createFacility = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/v1/facilities", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: facilityForm.code, name: facilityForm.name, type: facilityForm.type,
          timezone: facilityForm.timezone,
          address: { city: facilityForm.city || undefined, countryCode: facilityForm.countryCode || undefined }
        })
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Facility could not be created.");
      setNotice("Facility created successfully.");
      setFacilityForm({ code: "", name: "", type: "office", city: "", countryCode: "IN", timezone: "Asia/Kolkata" });
      setShowCreate(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Facility could not be created."); }
    finally { setSaving(false); }
  };

  const createAsset = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/v1/assets", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(assetForm)
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Asset could not be registered.");
      setNotice("Energy asset registered successfully.");
      setAssetForm((current) => ({ ...current, assetTag: "", name: "", manufacturer: "", serialNumber: "" }));
      setShowCreate(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Asset could not be registered."); }
    finally { setSaving(false); }
  };

  const decommission = async (assetId: string) => {
    if (!window.confirm("Decommission this asset? Its registry history will be retained.")) return;
    const response = await apiFetch(`/api/v1/assets/${assetId}`, { method: "DELETE" });
    if (!response.ok) { setError("Asset could not be decommissioned."); return; }
    setNotice("Asset decommissioned. Historical registry data was retained.");
    await load();
  };

  const activeAssets = assets.filter((asset) => asset.status === "active").length;
  const solarAssets = assets.filter((asset) => asset.type === "solar_pv").length;

  return <div className="registry-page">
    <div className="page-heading registry-heading">
      <div><div className="eyebrow"><span className="live-dot"/> ASSET OPERATIONS <span className="sample-tag">LIVE REGISTRY</span></div>
        <h1>{mode === "facilities" ? "Facilities & sites" : "Energy asset registry"}</h1>
        <p>{mode === "facilities" ? "Organize your sites, buildings and operational locations." : "Track meters, generation, storage and flexible equipment."}</p>
      </div>
      <button className="export-button" onClick={() => setShowCreate((value) => !value)}><Plus size={15}/>{mode === "facilities" ? "Add facility" : "Register asset"}</button>
    </div>

    <div className="registry-stats">
      <article className="metric-card"><div className="metric-top"><span>Facilities</span><span className="metric-icon"><Building2 size={17}/></span></div><div className="metric-value">{facilities.length}</div><div className="metric-foot">Registered sites in this organization</div></article>
      <article className="metric-card"><div className="metric-top"><span>Total assets</span><span className="metric-icon"><Zap size={17}/></span></div><div className="metric-value">{assets.length}</div><div className="metric-foot">Equipment records</div></article>
      <article className="metric-card"><div className="metric-top"><span>Active assets</span><span className="metric-icon"><Activity size={17}/></span></div><div className="metric-value">{activeAssets}</div><div className="metric-foot">Not decommissioned</div></article>
      <article className="metric-card"><div className="metric-top"><span>Solar systems</span><span className="metric-icon"><Sun size={17}/></span></div><div className="metric-value">{solarAssets}</div><div className="metric-foot">Registered PV assets</div></article>
    </div>

    {notice && <div className="registry-success">{notice}</div>}
    {error && <div className="auth-error registry-error">{error}</div>}

    {showCreate && <section className="panel registry-form-panel">
      <div className="panel-heading"><div><h2>{mode === "facilities" ? "Create a facility" : "Register an energy asset"}</h2><p>Records are saved to the active organization only.</p></div><button className="registry-close" onClick={() => setShowCreate(false)}>×</button></div>
      {mode === "facilities" ? <form className="registry-form" onSubmit={(event) => void createFacility(event)}>
        <label>Facility name<input required minLength={2} maxLength={160} value={facilityForm.name} onChange={(event) => setFacilityForm({ ...facilityForm, name: event.target.value })} placeholder="North manufacturing campus"/></label>
        <label>Facility code<input required minLength={2} maxLength={40} value={facilityForm.code} onChange={(event) => setFacilityForm({ ...facilityForm, code: event.target.value.toUpperCase() })} placeholder="NORTH-CAMPUS"/></label>
        <label>Facility type<select value={facilityForm.type} onChange={(event) => setFacilityForm({ ...facilityForm, type: event.target.value })}>{facilityTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></label>
        <label>City<input maxLength={100} value={facilityForm.city} onChange={(event) => setFacilityForm({ ...facilityForm, city: event.target.value })} placeholder="Pune"/></label>
        <label>Country code<input maxLength={2} value={facilityForm.countryCode} onChange={(event) => setFacilityForm({ ...facilityForm, countryCode: event.target.value.toUpperCase() })} placeholder="IN"/></label>
        <label>Timezone<input required value={facilityForm.timezone} onChange={(event) => setFacilityForm({ ...facilityForm, timezone: event.target.value })} placeholder="Asia/Kolkata"/></label>
        <button className="auth-submit" disabled={saving} type="submit">{saving ? "Saving…" : "Create facility"}</button>
      </form> : <form className="registry-form" onSubmit={(event) => void createAsset(event)}>
        <label>Asset name<input required minLength={2} value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} placeholder="Main incoming meter"/></label>
        <label>Asset tag<input required minLength={2} value={assetForm.assetTag} onChange={(event) => setAssetForm({ ...assetForm, assetTag: event.target.value.toUpperCase() })} placeholder="MTR-001"/></label>
        <label>Facility<select required value={assetForm.facilityId} onChange={(event) => setAssetForm({ ...assetForm, facilityId: event.target.value })}>{facilities.map((facility) => <option key={facility._id} value={facility._id}>{facility.name}</option>)}</select></label>
        <label>Asset type<select value={assetForm.type} onChange={(event) => setAssetForm({ ...assetForm, type: event.target.value })}>{assetTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></label>
        <label>Manufacturer<input value={assetForm.manufacturer} onChange={(event) => setAssetForm({ ...assetForm, manufacturer: event.target.value })} placeholder="Manufacturer"/></label>
        <label>Serial number<input value={assetForm.serialNumber} onChange={(event) => setAssetForm({ ...assetForm, serialNumber: event.target.value })} placeholder="Serial number"/></label>
        <button className="auth-submit" disabled={saving || !facilities.length} type="submit">{saving ? "Saving…" : "Register asset"}</button>
      </form>}
    </section>}

    <section className="panel registry-table-panel">
      <div className="panel-heading"><div><h2>{mode === "facilities" ? "Organization facilities" : "Registered equipment"}</h2><p>{mode === "facilities" ? "Verified registry records for your sites." : "Asset identity and lifecycle status by facility."}</p></div>
        <div className="registry-tools"><label className="registry-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records"/></label><button className="icon-button" onClick={() => void load()} aria-label="Refresh registry"><RefreshCw size={16}/></button></div>
      </div>
      {loading ? <div className="registry-empty"><LoaderCircle className="spin" size={20}/> Loading organization registry…</div> :
        mode === "facilities" ? facilities.length ? <div className="table-wrap"><table><thead><tr><th>FACILITY</th><th>TYPE</th><th>LOCATION</th><th>ASSETS</th><th>STATUS</th></tr></thead><tbody>
          {facilities.map((facility) => <tr key={facility._id}><td><div className="facility-cell"><span className="facility-icon"><Building2 size={17}/></span><div><strong>{facility.name}</strong><small>{facility.code}</small></div></div></td><td>{titleCase(facility.type)}</td><td>{[facility.address?.city, facility.address?.region, facility.address?.countryCode].filter(Boolean).join(", ") || "—"}</td><td>{facility.assetCount ?? "—"}</td><td><span className={`status ${facility.status === "active" ? "healthy" : "attention"}`}><i/>{titleCase(facility.status)}</span></td></tr>)}
        </tbody></table></div> : <div className="registry-empty"><Building2 size={23}/> No facilities yet. Add your first site to begin.</div> :
        assets.length ? <div className="table-wrap"><table><thead><tr><th>ASSET</th><th>TYPE</th><th>FACILITY</th><th>MANUFACTURER</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
          {assets.map((asset) => <tr key={asset._id}><td><div className="facility-cell"><span className="facility-icon"><BatteryCharging size={17}/></span><div><strong>{asset.name}</strong><small>{asset.assetTag}{asset.serialNumber ? ` · ${asset.serialNumber}` : ""}</small></div></div></td><td>{titleCase(asset.type)}</td><td>{typeof asset.facilityId === "string" ? "—" : asset.facilityId.name}</td><td>{asset.manufacturer || "—"}</td><td><span className={`status ${asset.status === "active" ? "healthy" : "attention"}`}><i/>{titleCase(asset.status)}</span></td><td>{asset.status !== "decommissioned" && <button className="registry-icon-button" onClick={() => void decommission(asset._id)} aria-label={`Decommission ${asset.name}`}><Trash2 size={15}/></button>}</td></tr>)}
        </tbody></table></div> : <div className="registry-empty"><Zap size={23}/> No assets registered yet. Add meters and equipment to your facilities.</div>}
    </section>
    <p className="registry-footnote"><ArrowLeft size={13}/> Registry metadata only — live meter telemetry and energy readings will arrive in a later milestone.</p>
  </div>;
}
