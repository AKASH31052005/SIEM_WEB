import React, { useState, useEffect } from "react";
import API from "../api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "7px 11px", fontSize: 12 }}>
        {label && <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>{label}</p>}
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function MetricGauge({ label, value, max = 100, colorClass, unit = "%" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const isCritical = pct > 85;
  const isWarning = pct > 70;

  const activeColorClass = isCritical ? "red" : isWarning ? "orange" : colorClass || "green";
  const textColor = isCritical ? "var(--severity-critical)" : isWarning ? "var(--severity-high)" : colorClass === "purple" ? "var(--accent-purple)" : "var(--accent-green)";

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
        {label && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>}
        <span style={{
          fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 600, color: textColor
        }}>
          {typeof value === "number" ? value.toFixed(1) : "--"}{unit}
        </span>
      </div>
      <div className="progress-bar-wrap" style={{ height: 6 }}>
        <div
          className={`progress-bar ${activeColorClass}`}
          style={{ width: `${pct}%`, transition: "width 0.8s ease" }}
        />
      </div>
    </div>
  );
}

export default function SystemMetrics({ metrics: liveMet }) {
  const [history, setHistory] = useState([]);
  const [localMetrics, setLocalMetrics] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await API.get("/api/agent/metrics");
        if (res.data) {
          setLocalMetrics(res.data);
          const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          setHistory(prev => [...prev.slice(-29), {
            time: ts,
            cpu: res.data.cpu?.currentLoad ?? 0,
            memory: res.data.mem?.usedPercent ?? 0,
            disk: res.data.disk?.[0]?.usedPercent ?? 0,
          }]);
        }
      } catch { }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const m = localMetrics || liveMet;

  const cpu = m?.cpu?.currentLoad ?? null;
  const memUsed = m?.mem?.used ?? null;
  const memTotal = m?.mem?.total ?? null;
  const memPct = memTotal ? ((memUsed / memTotal) * 100) : null;
  const diskData = m?.disk ?? [];
  const netStats = m?.net ?? [];

  return (
    <div className="fade-in">
      {/* ── HEADER EXTENSION / CONTEXT ── */}
      <div style={{ padding: "0 2px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-success" style={{ fontSize: 10 }}>🔄 LIVE STREAM (5s)</span>
          {m?.os?.hostname && <span className="ip-badge">🖥️ {m.os.hostname}</span>}
        </div>
      </div>

      {/* ── STAT PANELS ── */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "CPU Usage", value: cpu, colorClass: cpu > 85 ? "red" : cpu > 70 ? "orange" : "green", icon: "🔲" },
          { label: "Memory", value: memPct, colorClass: memPct > 85 ? "red" : memPct > 70 ? "orange" : "blue", icon: "💾" },
          { label: "Disk (C:)", value: diskData[0]?.usedPercent ?? null, colorClass: "purple", icon: "💿" },
          { label: "Network TX", value: netStats[0]?.tx_sec != null ? (netStats[0].tx_sec / 1024).toFixed(1) : null, unit: " KB/s", colorClass: "orange", icon: "📡" },
        ].map(s => (
          <div key={s.label} className={`stat-panel ${s.colorClass}`}>
            <div className="stat-icon" style={{ opacity: 0.1 }}>{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.colorClass}`}>
              {s.value != null ? `${s.value}${s.unit || "%"}` : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* ── TIMELINE CHARTS ── */}
      <div className="panel-grid grid-2">
        {/* CPU Chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">📈</span> CPU Usage History
            </div>
            <span style={{ fontSize: 12, color: "var(--accent-green)", fontFamily: "JetBrains Mono, monospace" }}>
              {cpu?.toFixed(1) ?? "0"}%
            </span>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={history} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#73bf69" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#73bf69" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 100]} tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#73bf69" fill="url(#gCpu)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory Chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">💾</span> Memory Usage History
            </div>
            <span style={{ fontSize: 12, color: "var(--accent-blue)", fontFamily: "JetBrains Mono, monospace" }}>
              {memPct?.toFixed(1) ?? "0"}%
            </span>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={history} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5794f2" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5794f2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="memory" name="Memory %" stroke="#5794f2" fill="url(#gMem)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── DISK & NETWORK & SYSTEM INFO ── */}
      <div className="panel-grid grid-3">
        {/* Disk Usage */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">💿</span> Disk Volumes</div>
          </div>
          <div className="panel-body">
            {diskData.length > 0 ? diskData.map((disk, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
                    {disk.fs || disk.mount || `Drive ${i}`}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {disk.used != null ? `${(disk.used / 1e9).toFixed(1)}GB` : ""} / {disk.size != null ? `${(disk.size / 1e9).toFixed(1)}GB` : "—"}
                  </span>
                </div>
                <MetricGauge label="" value={disk.usedPercent ?? 0} colorClass="purple" />
                <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-muted)" }}>
                  <span>Type: <span style={{ color: "var(--text-secondary)" }}>{disk.type || "—"}</span></span>
                  <span>Mount: <span style={{ color: "var(--text-secondary)" }}>{disk.mount || "—"}</span></span>
                </div>
              </div>
            )) : <div className="empty-state" style={{ padding: "14px 0" }}><p>No disk data</p></div>}
          </div>
        </div>

        {/* Network Interfaces */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">📡</span> Network I/O</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 240 }}>
            {netStats.length > 0 ? netStats.filter(n => n.iface !== "lo").map((net, i) => (
              <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--accent-orange)", marginBottom: 8 }}>
                  {net.iface || `eth${i}`}
                </div>
                <div className="mini-stat-row">
                  <div className="mini-stat-key">TX / RX Rate</div>
                  <div className="mini-stat-val" style={{ fontSize: 11 }}>
                    <span style={{ color: "var(--accent-cyan)" }}>{net.tx_sec != null ? `${(net.tx_sec / 1024).toFixed(1)}` : "0"}</span> KB/s ↑ /&nbsp;
                    <span style={{ color: "var(--accent-green)" }}>{net.rx_sec != null ? `${(net.rx_sec / 1024).toFixed(1)}` : "0"}</span> KB/s ↓
                  </div>
                </div>
                <div className="mini-stat-row" style={{ borderBottom: "none" }}>
                  <div className="mini-stat-key">Total Transferred</div>
                  <div className="mini-stat-val" style={{ fontSize: 11 }}>
                    {net.tx_bytes != null ? `${(net.tx_bytes / 1e6).toFixed(1)}` : "0"} MB ↑ /&nbsp;
                    {net.rx_bytes != null ? `${(net.rx_bytes / 1e6).toFixed(1)}` : "0"} MB ↓
                  </div>
                </div>
              </div>
            )) : <div className="empty-state" style={{ padding: "14px 0" }}><p>No active interfaces</p></div>}
          </div>
        </div>

        {/* System Info */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🖥️</span> System Info</div>
          </div>
          <div className="panel-body">
            {m?.os ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "OS details", value: `${m.os.distro || ""} ${m.os.release || ""}`.trim() },
                  { label: "Architecture", value: m.os.arch },
                  { label: "Platform", value: m.os.platform },
                  { label: "Hostname", value: m.os.hostname },
                  { label: "Uptime", value: m.os.uptime ? `${Math.floor(m.os.uptime / 3600)}h ${Math.floor((m.os.uptime % 3600) / 60)}m` : "—" },
                ].map(row => (
                  <div key={row.label} className="mini-stat-row">
                    <div className="mini-stat-key">{row.label}</div>
                    <div className="mini-stat-val" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.value || "—"}</div>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state" style={{ padding: "14px 0" }}><p>Waiting for agent data...</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
