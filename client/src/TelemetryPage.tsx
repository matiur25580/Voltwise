import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, Check, Copy, LoaderCircle, RadioTower, RefreshCw, ShieldCheck, Signal, SignalZero, XCircle, Zap } from "lucide-react";
import { useAuth } from "./auth/AuthContext";

type Facility = { _id: string; name: string; code: string };
type Asset = { _id: string; name: string; assetTag: string; type: string; facilityId: string | { _id: string } };
type Device = { _id: string; deviceCode: string; name: string; status: string; lastSeenAt?: string | null; facilityId: Facility | string; assetId: Asset | string };
type Measurement = { metric: string; value: number; unit: string; quality: string };
type EventRecord = { _id: string; eventId: string; occurredAt: string; readings: Measurement[]; assetId?: Asset; deviceId?: Device };
type ProvisionResponse = { data: Device; deviceCredential: string; warning: string };

const metricName = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const displayValue = (reading: Measurement) => `${Number(reading.value.toFixed(3)).toLocaleString()} ${reading.unit}`;

export default function TelemetryPage() {
  const { apiFetch } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [streamState, setStreamState] = useState<"connecting" | "connected" | "offline">("connecting");
  const [credential, setCredential] = useState("");
  const [form, setForm] = useState({ facilityId: "", assetId: "", deviceCode: "", name: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [deviceResponse, facilityResponse, assetResponse, readingResponse] = await Promise.all([
        apiFetch("/api/v1/devices"), apiFetch("/api/v1/facilities?limit=100"),
        apiFetch("/api/v1/assets?limit=100"), apiFetch("/api/v1/telemetry/readings?limit=40")
      ]);
      if (![deviceResponse, facilityResponse, assetResponse, readingResponse].every((response) => response.ok)) {
        throw new Error("Unable to load device and telemetry data for this organization.");
      }
      const [deviceBody, facilityBody, assetBody, readingBody] = await Promise.all([
        deviceResponse.json() as Promise<{ data: Device[] }>,
        facilityResponse.json() as Promise<{ data: Facility[] }>,
        assetResponse.json() as Promise<{ data: Asset[] }>,
        readingResponse.json() as Promise<{ data: EventRecord[] }>
      ]);
      setDevices(deviceBody.data); setFacilities(facilityBody.data); setAssets(assetBody.data); setEvents(readingBody.data);
      setForm((current) => ({ ...current, facilityId: current.facilityId || facilityBody.data[0]?._id || "", assetId: current.assetId || assetBody.data[0]?._id || "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load telemetry workspace."); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const connect = async () => {
      try {
        const response = await apiFetch("/api/v1/telemetry/stream", { signal: controller.signal, headers: { Accept: "text/event-stream" } });
        if (!response.ok || !response.body) throw new Error("Telemetry stream unavailable");
        if (active) setStreamState("connected");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (active) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            if (!frame.includes("event: reading")) continue;
            const data = frame.split("\n").find((line) => line.startsWith("data: "));
            if (!data) continue;
            try {
              const next = JSON.parse(data.slice(6)) as EventRecord;
              setEvents((current) => [next, ...current.filter((item) => item.eventId !== next.eventId)].slice(0, 40));
            } catch { /* Ignore malformed stream frames; the API validates persisted events. */ }
          }
        }
      } catch {
        if (active && !controller.signal.aborted) setStreamState("offline");
      }
    };
    void connect();
    return () => { active = false; controller.abort(); };
  }, [apiFetch]);

  const createDevice = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice(""); setCredential("");
    try {
      const response = await apiFetch("/api/v1/devices", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const body = await response.json() as ProvisionResponse | { error?: { message?: string } };
      if (!response.ok || !("deviceCredential" in body)) throw new Error(("error" in body ? body.error?.message : undefined) ?? "Device could not be provisioned.");
      setCredential(body.deviceCredential);
      setNotice("Device provisioned. Copy its credential now; it will not be shown again.");
      setForm((current) => ({ ...current, deviceCode: "", name: "" }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Device could not be provisioned."); }
    finally { setSaving(false); }
  };

  const revokeDevice = async (deviceId: string) => {
    if (!window.confirm("Revoke this device credential? The device will no longer be able to submit telemetry.")) return;
    const response = await apiFetch(`/api/v1/devices/${deviceId}/revoke`, { method: "POST" });
    if (!response.ok) { setError("Device credential could not be revoked."); return; }
    setNotice("Device credential revoked."); await load();
  };

  const latest = events[0];
  const latestPower = events.flatMap((event) => event.readings.map((reading) => ({ ...reading, occurredAt: event.occurredAt }))).find((reading) => reading.metric === "active_power");
  const latestEnergy = events.flatMap((event) => event.readings.map((reading) => ({ ...reading, occurredAt: event.occurredAt }))).find((reading) => reading.metric === "energy_import");
  const activeDevices = devices.filter((device) => device.status === "active").length;

  return <div className="telemetry-page">
    <div className="page-heading telemetry-heading">
      <div><div className="eyebrow"><span className="live-dot"/> CONNECTED OPERATIONS <span className="sample-tag">DEVICE TELEMETRY</span></div>
        <h1>Live telemetry</h1><p>Provision trusted devices and monitor incoming energy measurements.</p></div>
      <button className="export-button" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button>
    </div>

    <div className="telemetry-status"><span className={`stream-indicator ${streamState}`}/><strong>{streamState === "connected" ? "Live stream connected" : streamState === "connecting" ? "Connecting to live stream…" : "Live stream disconnected"}</strong><span>Server-sent events · tenant-isolated channel</span></div>

    <div className="registry-stats">
      <article className="metric-card"><div className="metric-top"><span>Registered devices</span><span className="metric-icon"><RadioTower size={17}/></span></div><div className="metric-value">{devices.length}</div><div className="metric-foot">Provisioned in this organization</div></article>
      <article className="metric-card"><div className="metric-top"><span>Active credentials</span><span className="metric-icon"><ShieldCheck size={17}/></span></div><div className="metric-value">{activeDevices}</div><div className="metric-foot">Authorized to publish readings</div></article>
      <article className="metric-card"><div className="metric-top"><span>Latest active power</span><span className="metric-icon"><Zap size={17}/></span></div><div className="metric-value telemetry-metric">{latestPower ? displayValue(latestPower) : "—"}</div><div className="metric-foot">{latestPower ? new Date(latestPower.occurredAt).toLocaleTimeString() : "Awaiting meter data"}</div></article>
      <article className="metric-card"><div className="metric-top"><span>Latest imported energy</span><span className="metric-icon"><Activity size={17}/></span></div><div className="metric-value telemetry-metric">{latestEnergy ? displayValue(latestEnergy) : "—"}</div><div className="metric-foot">{latestEnergy ? new Date(latestEnergy.occurredAt).toLocaleTimeString() : "Awaiting meter data"}</div></article>
    </div>

    {notice && <div className="registry-success">{notice}</div>}
    {error && <div className="auth-error registry-error">{error}</div>}
    {credential && <section className="panel credential-panel"><div><strong>Device credential — shown once</strong><p>Store it in the device's secret manager. Do not commit it to source control.</p></div><code>{credential}</code><button className="export-button" onClick={() => void navigator.clipboard.writeText(credential)}><Copy size={14}/> Copy key</button></section>}

    <div className="telemetry-layout">
      <section className="panel">
        <div className="panel-heading"><div><h2>Provision a device</h2><p>Bind a meter or energy asset to a secure device identity.</p></div><span className="metric-icon"><RadioTower size={17}/></span></div>
        <form className="registry-form telemetry-form" onSubmit={(event) => void createDevice(event)}>
          <label>Device name<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Main meter gateway"/></label>
          <label>Unique device code<input required minLength={3} value={form.deviceCode} onChange={(event) => setForm({ ...form, deviceCode: event.target.value.toUpperCase() })} placeholder="PUNE-MTR-001"/></label>
          <label>Facility<select required value={form.facilityId} onChange={(event) => setForm({ ...form, facilityId: event.target.value, assetId: "" })}><option value="">Select facility</option>{facilities.map((facility) => <option key={facility._id} value={facility._id}>{facility.name}</option>)}</select></label>
          <label>Energy asset<select required value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })}><option value="">Select asset</option>{assets.filter((asset) => typeof asset.facilityId === "string" ? asset.facilityId === form.facilityId : asset.facilityId._id === form.facilityId).map((asset) => <option key={asset._id} value={asset._id}>{asset.assetTag} · {asset.name}</option>)}</select></label>
          <button className="auth-submit" disabled={saving || !form.facilityId || !form.assetId} type="submit">{saving ? "Provisioning…" : "Provision device"}</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h2>Device fleet</h2><p>Credential status and last communication.</p></div><span className="metric-icon"><Signal size={17}/></span></div>
        {loading ? <div className="registry-empty"><LoaderCircle className="spin" size={20}/> Loading devices…</div> : devices.length ? <div className="device-list">{devices.map((device) => <div className="device-row" key={device._id}><span className={`device-state ${device.status}`}>{device.status === "active" ? <Signal size={15}/> : <SignalZero size={15}/>}</span><div className="device-info"><strong>{device.name}</strong><small>{device.deviceCode} · {device.lastSeenAt ? `Seen ${new Date(device.lastSeenAt).toLocaleString()}` : "Never connected"}</small></div><span className={`status ${device.status === "active" ? "healthy" : "attention"}`}><i/>{device.status}</span>{device.status === "active" && <button className="registry-icon-button" onClick={() => void revokeDevice(device._id)} aria-label={`Revoke ${device.name}`}><XCircle size={15}/></button>}</div>)}</div> : <div className="registry-empty"><RadioTower size={22}/> No devices provisioned yet.</div>}
      </section>
    </div>

    <section className="panel telemetry-events">
      <div className="panel-heading"><div><h2>Incoming measurements</h2><p>Persisted, normalized device events. New readings appear automatically.</p></div><span className="metric-icon"><Activity size={17}/></span></div>
      {events.length ? <div className="table-wrap"><table><thead><tr><th>TIME</th><th>ASSET / DEVICE</th><th>MEASUREMENT</th><th>VALUE</th><th>QUALITY</th></tr></thead><tbody>{events.slice(0,20).flatMap((event) => event.readings.map((reading, index) => <tr key={`${event._id}-${index}`}><td>{new Date(event.occurredAt).toLocaleString()}</td><td><strong>{event.assetId?.name ?? "Energy asset"}</strong><small className="table-subline">{event.deviceId?.deviceCode ?? event.eventId}</small></td><td>{metricName(reading.metric)}</td><td>{displayValue(reading)}</td><td><span className={`status ${reading.quality === "good" ? "healthy" : "attention"}`}><i/>{reading.quality}</span></td></tr>))}</tbody></table></div> : <div className="registry-empty"><Activity size={22}/> No readings yet. Start the simulator to stream sample meter data.</div>}
    </section>
    <p className="registry-footnote"><Check size={13}/> Data shown here is persisted telemetry from connected devices or the local simulator — not the overview's demonstration metrics.</p>
  </div>;
}
