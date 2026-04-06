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

export default function DatabaseDashboard({ logs }) {
  const [search, setSearch] = useState("");
  const [opFilter, setOpFilter] = useState("All");

  const dbLogs = useMemo(() =>
    logs.filter(l => (l.source || l.logType || "").toLowerCase() === "database"),
    [logs]
  );

  const operations = useMemo(() => {
    const s = new Set(dbLogs.map(l => l.operation || l.action || l.operationType || l.method).filter(Boolean));
    return ["All", ...Array.from(s)];
  }, [dbLogs]);

  const filtered = useMemo(() => {
    return dbLogs.filter(l => {
      const msgSearch = !search ||
        (l.query || l.table || l.collection || l.message || "").toLowerCase().includes(search.toLowerCase());
      const matchOp = opFilter === "All" || (l.operation || l.action || l.operationType || l.method) === opFilter;
      return msgSearch && matchOp;
    });
  }, [dbLogs, search, opFilter]);

  const opChart = useMemo(() => {
    const counts = {};
    dbLogs.forEach(l => {
      const o = l.operation || l.action || l.operationType || l.method || "unknown";
      counts[o] = (counts[o] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [dbLogs]);

  // Extra data for new panels
  const topDatabases = useMemo(() => {
    const counts = {};
    dbLogs.forEach(l => { const d = l.database || "unknown"; counts[d] = (counts[d] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [dbLogs]);

  const topTables = useMemo(() => {
    const counts = {};
    dbLogs.forEach(l => { const t = l.table || l.collection || "unknown"; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [dbLogs]);

  const topUsers = useMemo(() => {
    const counts = {};
    dbLogs.forEach(l => { const u = l.user || l.username || "unknown"; counts[u] = (counts[u] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [dbLogs]);

  const statusPie = useMemo(() => {
    let success = 0, failed = 0;
    dbLogs.forEach(l => {
      if (l.status === "failed" || l.status === "error") failed++;
      else success++;
    });
    return [{ name: "Success", count: success, color: "#73bf69" }, { name: "Failed", count: failed, color: "#f2495c" }];
  }, [dbLogs]);

  const failedQueries = useMemo(() => {
    return dbLogs.filter(l => l.status === "failed" || l.status === "error").slice(0, 5);
  }, [dbLogs]);

  return (
    <div className="fade-in">
      <div style={{ padding: "0 2px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-info" style={{ fontSize: 10 }}>🗄️ DATABASE ACTIVITY</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{dbLogs.length.toLocaleString()} total query logs</span>
        </div>
      </div>

      {/* Row 1: 4 Stat Panels */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-panel" style={{ borderTop: `2px solid #5794f2` }}>
          <div className="stat-label">Total Queries</div>
          <div className="stat-value blue">{dbLogs.length}</div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #f2c94c` }}>
          <div className="stat-label">Select Operations</div>
          <div className="stat-value yellow">
            {dbLogs.filter(l => {
                const op = (l.operation || l.action || l.operationType || l.method || "").toUpperCase();
                return op === "SELECT" || op === "FIND";
            }).length}
          </div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #ff7800` }}>
          <div className="stat-label">Mutations (Ins/Upd/Del)</div>
          <div className="stat-value orange">
            {dbLogs.filter(l => ["INSERT", "UPDATE", "DELETE"].includes((l.operation || l.action || l.operationType || l.method || "").toUpperCase())).length}
          </div>
        </div>
        <div className="stat-panel" style={{ borderTop: `2px solid #f2495c` }}>
          <div className="stat-label">Failed Queries</div>
          <div className="stat-value red">
            {dbLogs.filter(l => l.status === "failed" || l.status === "error").length}
          </div>
        </div>
      </div>

      {/* Row 2: Charts (Panels 5 and 6) */}
      <div className="panel-grid grid-65-35">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">📊</span> Query Operations</div>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={opChart} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" fill="#f2c94c" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🥧</span> Success vs Failed</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#9fa7b3' }}/>
                <Pie data={statusPie} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                  {statusPie.map((entry, index) => (
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
        {/* Top Databases */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">📂</span> Top Databases</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topDatabases.map(([db, count], i) => (
              <div key={db} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label" style={{ fontFamily: "JetBrains Mono, monospace" }}>{db}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Tables */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">🗂️</span> Top Tables/Collections</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topTables.map(([tbl, count], i) => (
              <div key={tbl} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label" style={{ fontFamily: "JetBrains Mono, monospace" }}>{tbl}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Users */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">👤</span> Top DB Users</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topUsers.map(([usr, count], i) => (
              <div key={usr} className="metric-row">
                <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span className="metric-label">{usr}</span>
                <span className="metric-val">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Lists (Panel 10, Panel 11) */}
      <div className="panel-grid grid-50-50">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">⚠️</span> Recent Failed Queries</div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 250 }}>
            {failedQueries.length > 0 ? (
              <table className="data-table">
                <tbody>
                  {failedQueries.map((log, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>
                        {(log.query || log.message || "—").substring(0, 50)}...
                      </td>
                      <td><span className="badge badge-critical">Failed</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty-state"><p>No failed queries</p></div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">📋</span> Database Audit Log</div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} matched</span>
          </div>
          
          <div className="toolbar" style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: "10px" }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 150 }}>
              <span>🔍</span>
              <input
                placeholder="Search queries..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={opFilter} onChange={e => setOpFilter(e.target.value)}>
              {operations.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          <div className="panel-body no-pad scroll" style={{ maxHeight: 250 }}>
            {filtered.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 14 }}>Database</th>
                    <th>User</th>
                    <th>Operation</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 50).map((log, i) => (
                    <tr key={log._id || i}>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--accent-cyan)", paddingLeft: 14 }}>
                        {log.database || "—"}
                      </td>
                      <td>{log.user || log.username || "—"}</td>
                      <td>
                        <span className="ip-badge" style={{ color: "#f2c94c", borderColor: "rgba(242,201,76,0.3)" }}>
                          {log.operation || log.action || log.operationType || log.method || "—"}
                        </span>
                      </td>
                      <td><span className={`badge ${log.status === "failed" ? "badge-critical" : "badge-success"}`}>{log.status || "success"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🗄️</div>
                <p>No activity logs found</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
