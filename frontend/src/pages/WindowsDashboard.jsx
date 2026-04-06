import React, { useState, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";


const EVENT_DESCRIPTIONS = {
  4624: "Successful Logon",
  4625: "Failed Logon",
  4634: "Logoff",
  4647: "User Initiated Logoff",
  4648: "Explicit Credentials Logon",
  4672: "Admin Logon / Privilege Escalation",
  4720: "User Account Created",
  4726: "User Account Deleted",
  4732: "Member Added to Group",
  4740: "Account Locked Out",
  4688: "Process Created",
  4697: "Service Installed",
  1102: "Audit Log Cleared",
  6005: "System Startup",
  6006: "System Shutdown",
  41: "System Unexpected Restart",
  7045: "Service Installed",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "7px 11px", fontSize: 12 }}>
        <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>Event {label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill || "#5794f2", fontWeight: 600 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function WindowsDashboard({ logs }) {
  const windowsLogs = logs;   // ✅ FIX
  console.log("🪟 Windows logs count:", windowsLogs.length);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");


  const eventIds = useMemo(() => {
    const ids = new Set(windowsLogs.map(l => l.EventID || l.eventId).filter(Boolean));
    return ["All", ...Array.from(ids).sort((a, b) => a - b)];
  }, [windowsLogs]);

  const filtered = useMemo(() => {
    return windowsLogs.filter(l => {
      const msgSearch = !search ||
        (l.Message || l.message || "").toLowerCase().includes(search.toLowerCase()) ||
        String(l.EventID || l.eventId || "").includes(search);
      const matchEvent = eventFilter === "All" || String(l.EventID || l.eventId) === eventFilter;
      const matchLevel = levelFilter === "All" || (l.Level || l.level) === levelFilter;
      return msgSearch && matchEvent && matchLevel;
    });
  }, [windowsLogs, search, eventFilter, levelFilter]);

  const eventChart = useMemo(() => {
    const counts = {};
    windowsLogs.forEach(l => {
      const id = l.EventID || l.eventId || "?";
      counts[id] = (counts[id] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id, count]) => ({ id: `E${id}`, count, name: EVENT_DESCRIPTIONS[id] || `Event ${id}` }));
  }, [windowsLogs]);

  const securityCounts = useMemo(() => {
    const events = [4624, 4625, 4672, 4720, 4740, 4688];
    return events.map(id => ({
      id,
      label: EVENT_DESCRIPTIONS[id],
      count: windowsLogs.filter(l => (l.EventID || l.eventId) === id).length,
    }));
  }, [windowsLogs]);

  // Extra data for new panels
  const topMachines = useMemo(() => {
    const counts = {};
    windowsLogs.forEach(l => { const m = l.MachineName || l.machineName || "unknown"; counts[m] = (counts[m] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [windowsLogs]);

  const topUsers = useMemo(() => {
    const counts = {};
    windowsLogs.forEach(l => {
      let u = l.Username || l.username || "unknown";
      if (u === "NT AUTHORITY\\SYSTEM" || u === "SYSTEM") u = "SYSTEM";
      counts[u] = (counts[u] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [windowsLogs]);

  const levelPie = useMemo(() => {
    const counts = {};
    windowsLogs.forEach(l => { const lvl = l.Level || l.level || "unknown"; counts[lvl] = (counts[lvl] || 0) + 1; });
    const cols = { "Information": "#5794f2", "Warning": "#f2c94c", "Error": "#ff7800", "Critical": "#f2495c", "unknown": "#8e99a8" };
    return Object.entries(counts).map(([name, count]) => ({ name, count, color: cols[name] || cols["unknown"] }));
  }, [windowsLogs]);

  const getLevelBadge = (level) => {
    if (!level) return "badge-muted";
    const l = level.toLowerCase();
    if (l.includes("critical") || l.includes("error")) return "badge-critical";
    if (l.includes("warning")) return "badge-medium";
    if (l.includes("info")) return "badge-info";
    return "badge-muted";
  };

  const SEV_COLOR_MAP = {
    4625: "#f2495c", // Failed
    4740: "#f2495c", // Lockout
    4672: "#ff7800", // Admin
    4720: "#f2c94c", // Account created
  };

  return (
    <div className="fade-in">
      {/* ── HEADER EXTENSION / CONTEXT ── */}
      <div style={{ padding: "0 2px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-info" style={{ fontSize: 10 }}>🪟 WINDOWS SECURITY</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{windowsLogs.length.toLocaleString()} total events indexed</span>
        </div>
      </div>

      {/* ── SECURITY EVENT PANELS (Top Row) ── */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {securityCounts.slice(0, 6).map(ev => {
          const cColor = SEV_COLOR_MAP[ev.id] || "var(--accent-blue)";
          return (
            <div key={ev.id} className="stat-panel" style={{ padding: "12px", borderTop: `2px solid ${cColor}` }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", marginBottom: 4 }}>
                ID: {ev.id}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: cColor, marginBottom: 4, lineHeight: 1 }}>{ev.count}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.2 }}>{ev.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── ROW 1: Chart & Pie ── */}
      <div className="panel-grid grid-50-50">
        {/* Frequency Chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">📊</span> Event ID Distribution</div>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={eventChart} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="id" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {eventChart.map((entry, i) => (
                    <Cell key={i} fill={entry.id.includes("4625") || entry.id.includes("4740") ? "#f2495c" : entry.id.includes("4672") ? "#ff7800" : "#5794f2"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Level Pie Chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🥧</span> Severity Level Distribution</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie data={levelPie} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                  {levelPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Lists ── */}
      <div className="panel-grid grid-3">
        {/* Top Machines */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🖥️</span> Top Machines</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topMachines.map(([m, count], i) => (
              <div key={m} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label" style={{ fontFamily: "JetBrains Mono, monospace" }}>{m}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Users */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">👤</span> Top Users</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topUsers.map(([u, count], i) => (
              <div key={u} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label">{u}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🔐</span> Security Event Keys</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {Object.entries(EVENT_DESCRIPTIONS).slice(0, 10).map(([id, desc]) => (
              <div key={id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <span className="ip-badge" style={{ flexShrink: 0, width: 45, textAlign: "center" }}>{id}</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 3: Event Table ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title"><span className="panel-title-icon">📋</span> Windows Event Feed</div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} matched</span>
        </div>

        <div className="toolbar" style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: "10px" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <span>🔍</span>
            <input
              placeholder="Search message or Event ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="filter-select" value={eventFilter} onChange={e => setEventFilter(e.target.value)}>
            {eventIds.map(v => <option key={v}>{v}</option>)}
          </select>
          <select className="filter-select" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
            {["All", "Information", "Warning", "Error", "Critical"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        <div className="panel-body no-pad scroll" style={{ maxHeight: 400 }}>
          {filtered.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 14 }}>Time</th>
                  <th>ID</th>
                  <th>Level</th>
                  <th>Machine</th>
                  <th>User</th>
                  <th>Source IP</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((log, i) => (
                  <tr key={log._id || i}>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)", paddingLeft: 14 }}>
                      {new Date(log.TimeCreated || log.timestamp || log.createdAt).toLocaleTimeString()}
                    </td>
                    <td><span className="ip-badge">{log.EventID || log.eventId || "—"}</span></td>
                    <td>
                      <span className={`badge ${getLevelBadge(log.Level || log.level)}`}>
                        {log.Level || log.level || "—"}
                      </span>
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--accent-cyan)" }}>
                      {log.MachineName || log.machineName || "—"}
                    </td>
                    <td style={{ fontSize: 11 }}>{log.Username || log.username || "—"}</td>
                    <td>
                      {(log.SourceIP || log.sourceIP) && (
                        <span className="ip-badge">{log.SourceIP || log.sourceIP}</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 280, color: "var(--text-primary)" }}>
                      {(log.Message || log.message || "—").substring(0, 90)}
                      {(log.Message || log.message || "").length > 90 ? "…" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🪟</div>
              <p>No Windows event logs found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
