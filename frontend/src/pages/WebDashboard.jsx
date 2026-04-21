import React, { useState, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Legend } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "7px 11px", fontSize: 12 }}>
        <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill || "#5794f2", fontWeight: 600 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function WebDashboard({ logs, totalCount }) {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");

  const webLogs = useMemo(() =>
    logs.filter(l => (l.source || l.logType || "").toLowerCase() === "web" ||
                     l.method !== undefined),
    [logs]
  );

  const methods = useMemo(() => {
    const s = new Set(webLogs.map(l => l.method).filter(Boolean));
    return ["All", ...Array.from(s)];
  }, [webLogs]);

  const filtered = useMemo(() => {
    return webLogs.filter(l => {
      const msgSearch = !search ||
        (l.url || l.path || l.endpoint || "").toLowerCase().includes(search.toLowerCase()) ||
        String(l.status || l.statusCode || "").includes(search);
      const matchMethod = methodFilter === "All" || l.method === methodFilter;
      return msgSearch && matchMethod;
    });
  }, [webLogs, search, methodFilter]);

  const statusChart = useMemo(() => {
    const counts = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    webLogs.forEach(l => {
      const s = parseInt(l.status || l.statusCode, 10);
      if (s >= 200 && s < 300) counts["2xx"]++;
      else if (s >= 300 && s < 400) counts["3xx"]++;
      else if (s >= 400 && s < 500) counts["4xx"]++;
      else if (s >= 500) counts["5xx"]++;
    });
    return [
      { name: "2xx Success", count: counts["2xx"], color: "#73bf69" },
      { name: "3xx Redirect", count: counts["3xx"], color: "#5794f2" },
      { name: "4xx Client Err", count: counts["4xx"], color: "#ff7800" },
      { name: "5xx Server Err", count: counts["5xx"], color: "#f2495c" }
    ];
  }, [webLogs]);

  const methodChart = useMemo(() => {
    const counts = {};
    webLogs.forEach(l => {
      const m = l.method || "UNKNOWN";
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [webLogs]);

  // Extra data for new panels
  const topIps = useMemo(() => {
    const counts = {};
    webLogs.forEach(l => { const ip = l.ip || l.sourceIP || "unknown"; counts[ip] = (counts[ip] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [webLogs]);

  const topPaths = useMemo(() => {
    const counts = {};
    webLogs.forEach(l => { const p = l.url || l.path || l.endpoint || "unknown"; counts[p] = (counts[p] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [webLogs]);

  const topUAs = useMemo(() => {
    const counts = {};
    webLogs.forEach(l => { const ua = l.userAgent || l.user_agent || "unknown"; counts[ua] = (counts[ua] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [webLogs]);

  const COLORS = ["#3274d9", "#f2c94c", "#ff7800", "#f2495c", "#b877d9"];

  return (
    <div className="fade-in">
      <div style={{ padding: "0 2px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-info" style={{ fontSize: 10 }}>🌩️ WEB LOGS</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(totalCount ?? webLogs.length).toLocaleString()} total requests indexed</span>
        </div>
      </div>

      {/* Row 1: 4 Stat Panels */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-panel" style={{ borderTop: `2px solid #5794f2` }}>
          <div className="stat-label">Total Requests</div>
          <div className="stat-value blue">{(totalCount ?? webLogs.length).toLocaleString()}</div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #f2495c` }}>
          <div className="stat-label">Server Errors (5xx)</div>
          <div className="stat-value red">
            {webLogs.filter(l => parseInt(l.status || l.statusCode, 10) >= 500).length}
          </div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #ff7800` }}>
          <div className="stat-label">Client Errors (4xx)</div>
          <div className="stat-value orange">
            {webLogs.filter(l => parseInt(l.status || l.statusCode, 10) >= 400 && parseInt(l.status || l.statusCode, 10) < 500).length}
          </div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #f2c94c` }}>
          <div className="stat-label">Unique IPs</div>
          <div className="stat-value yellow">
            {new Set(webLogs.map(l => l.ip || l.sourceIP).filter(Boolean)).size}
          </div>
        </div>
      </div>

      {/* Row 2: Charts (Panels 5 and 6) */}
      <div className="panel-grid grid-50-50">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">📊</span> Status Code Distribution</div>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusChart} margin={{ top: 0, right: 12, left: 0, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={85} />
                <XAxis type="number" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                  {statusChart.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🥧</span> HTTP Methods</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#9fa7b3' }}/>
                <Pie data={methodChart} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                  {methodChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Lists (Panels 7, 8, 9) */}
      <div className="panel-grid grid-3">
        {/* Top IPs */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🌍</span> Top Client IPs</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topIps.map(([ip, count], i) => (
              <div key={ip} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="ip-badge">{ip}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Paths */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🔗</span> Top Requested Paths</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topPaths.map(([path, count], i) => (
              <div key={path} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label" style={{ fontFamily: "JetBrains Mono, monospace" }}>{path}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top UAs */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">💻</span> Top User Agents</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topUAs.map(([ua, count], i) => (
              <div key={ua} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label" style={{ fontSize: "10px", lineHeight: "12px", paddingRight: 8 }} title={ua}>
                  {ua.substring(0, 40)}{ua.length > 40 ? "..." : ""}
                </span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Event Feed (Panel 10) */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title"><span className="panel-title-icon">📋</span> Access Logs Feed</div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} matched</span>
        </div>
        
        <div className="toolbar" style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: "10px" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <span>🔍</span>
            <input
              placeholder="Search URL path or status code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="filter-select" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
            {methods.map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        <div className="panel-body no-pad scroll" style={{ maxHeight: 400 }}>
          {filtered.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 14 }}>Time</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Client IP</th>
                  <th>URL Path</th>
                  <th>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((log, i) => (
                  <tr key={log._id || i}>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)", paddingLeft: 14 }}>
                      {new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.method || "—"}</td>
                    <td>
                      <span className={`badge ${parseInt(log.status || log.statusCode) >= 500 ? "badge-critical" : parseInt(log.status || log.statusCode) >= 400 ? "badge-high" : "badge-success"}`}>
                        {log.status || log.statusCode || "—"}
                      </span>
                    </td>
                    <td><span className="ip-badge">{log.ip || log.sourceIP || "—"}</span></td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--accent-cyan)", maxWidth: 200 }}>
                      {log.url || log.path || log.endpoint || "—"}
                    </td>
                    <td style={{ maxWidth: 200, color: "var(--text-muted)", fontSize: 10 }}>
                      {(log.userAgent || log.user_agent || "—").substring(0, 50)}
                      {(log.userAgent || log.user_agent || "").length > 50 ? "…" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🌩️</div>
              <p>No web access logs found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
