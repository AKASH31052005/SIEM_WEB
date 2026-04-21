import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "7px 11px", fontSize: 12 }}>
        {label && <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>{label}</p>}
        {payload.map((p, i) => <p key={i} style={{ color: p.color || p.fill || "#5794f2", fontWeight: 600 }}>{p.name}: {p.value}</p>)}
      </div>
    );
  }
  return null;
};

export default function NetworkPage({ alerts = [], logs = [], totalCount }) {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");

  const netLogs = useMemo(() =>
    logs.filter(l => (l.logType || "").toLowerCase() === "network" || l.srcIP !== undefined || l.destIP !== undefined),
    [logs]
  );

  useEffect(() => {
    if (netLogs.length === 0) return;
    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const t = now - (11 - i) * 300000;
      return {
        time: new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        events: 0, suspicious: 0
      };
    });
    if (!netLogs || netLogs.length === 0) {
      setHistory(buckets);
      return;
    }
    netLogs.forEach(l => {
      const ts = new Date(l.timestamp || l.createdAt).getTime();
      const idx = Math.floor((now - ts) / 300000);
      if (idx >= 0 && idx < 12) {
        const bucket = buckets[11 - idx];
        if (bucket) {
          bucket.events++;
          if (l.suspicious || l.severity === "High" || l.severity === "Critical") bucket.suspicious++;
        }
      }
    });
    setHistory(buckets);
  }, [netLogs]);

  const filtered = useMemo(() =>
    netLogs.filter(l =>
      !search ||
      (l.sourceIP || l.srcIP || l.src_ip || "").includes(search) ||
      (l.destIP || l.dst_ip || "").includes(search) ||
      (l.protocol || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.action || "").toLowerCase().includes(search.toLowerCase())
    ),
    [netLogs, search]
  );

  const topIPs = useMemo(() => {
    const counts = {};
    netLogs.forEach(l => {
      const ip = l.sourceIP || l.srcIP || l.src_ip;
      if (ip) counts[ip] = (counts[ip] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [netLogs]);

  const protocols = useMemo(() => {
    const counts = {};
    netLogs.forEach(l => { const p = l.protocol || "Unknown"; counts[p] = (counts[p] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [netLogs]);

  // Extra data for new panels
  const topDestIPs = useMemo(() => {
    const counts = {};
    netLogs.forEach(l => {
      const ip = l.destIP || l.dst_ip;
      if (ip) counts[ip] = (counts[ip] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [netLogs]);

  const topPorts = useMemo(() => {
    const counts = {};
    netLogs.forEach(l => {
      const p = l.destPort || l.port;
      if (p) counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [netLogs]);

  const actionPie = useMemo(() => {
    let allowed = 0, blocked = 0;
    netLogs.forEach(l => {
      if (l.action === "blocked" || l.action === "BLOCK") blocked++;
      else allowed++;
    });
    return [{name: "Allowed", count: allowed, color: "#73bf69"}, {name: "Blocked", count: blocked, color: "#f2495c"}];
  }, [netLogs]);

  const netAlerts = useMemo(() =>
    alerts.filter(a =>
      (a.type || "").toLowerCase().includes("scan") ||
      (a.type || "").toLowerCase().includes("flood") ||
      (a.type || "").toLowerCase().includes("dos") ||
      (a.source || "").toLowerCase().includes("network")
    ),
    [alerts]
  );

  const suspiciousCount = netLogs.filter(l => l.suspicious || l.severity === "High" || l.severity === "Critical").length;
  const uniqueIPs = new Set(netLogs.map(l => l.sourceIP || l.srcIP || l.src_ip).filter(Boolean)).size;

  return (
    <div className="fade-in">
      {/* ── STAT PANELS ── */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "Total Events",    value: totalCount ?? netLogs.length,  colorClass: "blue" },
          { label: "Unique Source IPs", value: uniqueIPs,     colorClass: "orange" },
          { label: "Suspicious",      value: suspiciousCount, colorClass: "red" },
          { label: "Network Alerts",  value: netAlerts.length, colorClass: "yellow" },
        ].map(s => (
          <div key={s.label} className={`stat-panel ${s.colorClass}`}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── ROW 1: Traffic Chart + Top Source IPs ── */}
      <div className="panel-grid grid-65-35" style={{ marginBottom: 8 }}>
        {/* Traffic Timeline */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">📈</span>
              Network Traffic — Last Hour
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--text-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 2, background: "#5794f2" }} /> Events
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 2, background: "#f2495c" }} /> Suspicious
              </div>
            </div>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={history} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#5794f2" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5794f2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f2495c" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f2495c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="events"     name="Events"     stroke="#5794f2" fill="url(#gEvents)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="suspicious" name="Suspicious" stroke="#f2495c" fill="url(#gSus)"    strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Source IPs */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🏆</span>Top Source IPs</div>
          </div>
          <div className="panel-body">
            {topIPs.length > 0 ? topIPs.map(([ip, count], i) => (
              <div key={ip} className="metric-row">
                <span style={{ color: "var(--text-muted)", minWidth: 16, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>{i + 1}</span>
                <span className="ip-badge" style={{ minWidth: 110, flexShrink: 0 }}>{ip}</span>
                <div className="metric-bar">
                  <div className="progress-bar-wrap">
                    <div className="progress-bar blue" style={{ width: `${(count / topIPs[0][1]) * 100}%` }} />
                  </div>
                </div>
                <span className="metric-val" style={{ color: "var(--accent-cyan)" }}>{count}</span>
              </div>
            )) : (
              <div className="empty-state"><p>No network data</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Top Dest IPs + Pie Chart + Top Ports ── */}
      <div className="panel-grid grid-3" style={{ marginBottom: 8 }}>
        {/* Top Dest IPs */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🎯</span>Top Dest IPs</div>
          </div>
          <div className="panel-body">
            {topDestIPs.length > 0 ? topDestIPs.map(([ip, count], i) => (
              <div key={ip} className="metric-row">
                <span style={{ color: "var(--text-muted)", minWidth: 16, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>{i + 1}</span>
                <span className="ip-badge" style={{ minWidth: 90, flexShrink: 0, borderColor: "rgba(184,119,217,0.3)", color: "#b877d9" }}>{ip}</span>
                <div className="metric-bar">
                  <div className="progress-bar-wrap">
                    <div className="progress-bar purple" style={{ width: `${(count / topDestIPs[0][1]) * 100}%` }} />
                  </div>
                </div>
                <span className="metric-val" style={{ color: "var(--accent-purple)" }}>{count}</span>
              </div>
            )) : (
              <div className="empty-state"><p>No network data</p></div>
            )}
          </div>
        </div>

        {/* Action Pie Chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🛡️</span>Action Distribution</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#9fa7b3' }}/>
                <Pie data={actionPie} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                  {actionPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Ports */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🚪</span>Top Dest Ports</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topPorts.length > 0 ? topPorts.map(([port, count], i) => (
              <div key={port} className="metric-row" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label" style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)" }}>Port {port}</span>
                <span className="metric-val">{count}</span>
              </div>
            )) : <div className="empty-state"><p>No port data</p></div>}
          </div>
        </div>
      </div>

      {/* ── ROW 3: Protocol Distribution + Event Log ── */}
      <div className="panel-grid grid-2">
        {/* Protocol Distribution */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🔌</span>Protocol Distribution</div>
          </div>
          <div className="panel-body">
            {protocols.length > 0 ? protocols.map(([proto, count]) => (
              <div key={proto} className="metric-row">
                <span className="metric-label">{proto}</span>
                <div className="metric-bar">
                  <div className="progress-bar-wrap">
                    <div className="progress-bar orange" style={{ width: `${protocols[0] ? (count / protocols[0][1]) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="metric-val" style={{ color: "var(--accent-orange)" }}>{count}</span>
              </div>
            )) : <div className="empty-state"><p>No protocol data</p></div>}
          </div>
        </div>

        {/* Recent Network Events */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🌐</span>Recent Network Events</div>
          </div>
          <div className="toolbar" style={{ padding: "8px 12px" }}>
            <div className="search-bar" style={{ flex: 1 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>🔍</span>
              <input placeholder="Search by IP, protocol..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 300 }}>
            {filtered.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Src IP</th>
                    <th>Dst IP</th>
                    <th>Proto</th>
                    <th>Port</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 50).map((log, i) => (
                    <tr key={log._id || i}>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
                      </td>
                      <td><span className="ip-badge">{log.sourceIP || log.srcIP || log.src_ip || "—"}</span></td>
                      <td><span className="ip-badge" style={{ borderColor: "rgba(184,119,217,0.3)", color: "#b877d9" }}>{log.destIP || log.dst_ip || "—"}</span></td>
                      <td style={{ fontSize: 11 }}>{log.protocol || "—"}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{log.destPort || log.port || "—"}</td>
                      <td>
                        <span className={`badge ${log.action === "blocked" || log.action === "BLOCK" ? "badge-critical" : "badge-success"}`} style={{ fontSize: 10 }}>
                          {log.action || "allow"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state"><div className="empty-icon">🌐</div><p>No network events</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
