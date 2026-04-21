import React, { useState, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "7px 11px", fontSize: 12 }}>
        <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>{label || "Value"}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill || "#5794f2", fontWeight: 600 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function LinuxDashboard({ logs, totalCount }) {
  const [search, setSearch] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("All");

  const linuxLogs = useMemo(() =>
    logs.filter(l => (l.source || l.logType || "").toLowerCase() === "linux" ||
                     l.facility !== undefined),
    [logs]
  );

  const facilities = useMemo(() => {
    const s = new Set(linuxLogs.map(l => l.facility).filter(Boolean));
    return ["All", ...Array.from(s)];
  }, [linuxLogs]);

  const filtered = useMemo(() => {
    return linuxLogs.filter(l => {
      const msgSearch = !search ||
        (l.message || l.Message || "").toLowerCase().includes(search.toLowerCase());
      const matchFacility = facilityFilter === "All" || l.facility === facilityFilter;
      return msgSearch && matchFacility;
    });
  }, [linuxLogs, search, facilityFilter]);

  const sysChart = useMemo(() => {
    const counts = {};
    linuxLogs.forEach(l => {
      const f = l.facility || "unknown";
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [linuxLogs]);

  // Extra data for new panels
  const topProcesses = useMemo(() => {
    const counts = {};
    linuxLogs.forEach(l => { const p = l.process || l.app_name || "unknown"; counts[p] = (counts[p] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [linuxLogs]);

  const topHosts = useMemo(() => {
    const counts = {};
    linuxLogs.forEach(l => { const h = l.hostname || l.host || "unknown"; counts[h] = (counts[h] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [linuxLogs]);

  const severityPie = useMemo(() => {
    const counts = {};
    linuxLogs.forEach(l => { const s = l.severity || l.priority || "unknown"; counts[s] = (counts[s] || 0) + 1; });
    const colors = ["#b877d9", "#f2c94c", "#ff7800", "#f2495c", "#5794f2"];
    return Object.entries(counts).map(([name, count], i) => ({ name, count, color: colors[i % colors.length] }));
  }, [linuxLogs]);

  const sshLogs = useMemo(() => {
    return linuxLogs.filter(l => (l.process || l.app_name || "").includes("sshd") || (l.message || "").includes("sshd")).slice(0, 5);
  }, [linuxLogs]);

  return (
    <div className="fade-in">
      <div style={{ padding: "0 2px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-info" style={{ fontSize: 10 }}>🐧 LINUX SYSLOG</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(totalCount ?? linuxLogs.length).toLocaleString()} total events indexed</span>
        </div>
      </div>

      {/* Row 1: 4 Stat Panels */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-panel" style={{ borderTop: `2px solid #5794f2` }}>
          <div className="stat-label">Total Logs</div>
          <div className="stat-value blue">{(totalCount ?? linuxLogs.length).toLocaleString()}</div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #f2495c` }}>
          <div className="stat-label">Auth Failures</div>
          <div className="stat-value red">
            {linuxLogs.filter(l => (l.message || "").toLowerCase().includes("failed password")).length}
          </div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #ff7800` }}>
          <div className="stat-label">Sudo Commands</div>
          <div className="stat-value orange">
            {linuxLogs.filter(l => (l.message || "").toLowerCase().includes("sudo")).length}
          </div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #b877d9` }}>
          <div className="stat-label">Cron Jobs</div>
          <div className="stat-value purple">
            {linuxLogs.filter(l => l.facility === "cron").length}
          </div>
        </div>
      </div>

      {/* Row 2: Charts (Panels 5 and 6) */}
      <div className="panel-grid grid-65-35">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">📊</span> Top Facilities</div>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sysChart} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" fill="#b877d9" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🥧</span> Severity Distribution</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie data={severityPie} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                  {severityPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Lists (Panels 7, 8, and 9) */}
      <div className="panel-grid grid-3">
        {/* Top Processes */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">⚙️</span> Top Processes</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topProcesses.map(([proc, count], i) => (
              <div key={proc} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label" style={{ fontFamily: "JetBrains Mono, monospace" }}>{proc}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Hosts */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🖥️</span> Top Hosts</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topHosts.map(([host, count], i) => (
              <div key={host} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label" style={{ fontFamily: "JetBrains Mono, monospace" }}>{host}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent SSH Logs */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🔐</span> Recent SSH Logs</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {sshLogs.length > 0 ? (
              <table className="data-table">
                <tbody>
                  {sshLogs.map((log, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                        {new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
                      </td>
                      <td style={{ fontSize: 11, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty-state"><p>No SSH logs</p></div>}
          </div>
        </div>
      </div>

      {/* Row 4: Event Feed (Panel 10) */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title"><span className="panel-title-icon">📋</span> Linux Event Feed</div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} matched</span>
        </div>
        
        <div className="toolbar" style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: "10px" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <span>🔍</span>
            <input
              placeholder="Search syslog message..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="filter-select" value={facilityFilter} onChange={e => setFacilityFilter(e.target.value)}>
            {facilities.map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        <div className="panel-body no-pad scroll" style={{ maxHeight: 400 }}>
          {filtered.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 14 }}>Time</th>
                  <th>Host</th>
                  <th>Facility</th>
                  <th>Severity</th>
                  <th>Process</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((log, i) => (
                  <tr key={log._id || i}>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)", paddingLeft: 14 }}>
                      {new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--accent-cyan)" }}>
                      {log.hostname || log.host || "—"}
                    </td>
                    <td>
                      <span className="ip-badge" style={{ color: "#b877d9", borderColor: "rgba(184,119,217,0.3)" }}>
                        {log.facility || "—"}
                      </span>
                    </td>
                    <td><span className="badge badge-muted">{log.severity || "—"}</span></td>
                    <td style={{ fontSize: 11 }}>{log.process || log.app_name || "—"}</td>
                    <td style={{ maxWidth: 350, color: "var(--text-primary)" }}>
                      {(log.message || log.Message || "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🐧</div>
              <p>No Linux events found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
