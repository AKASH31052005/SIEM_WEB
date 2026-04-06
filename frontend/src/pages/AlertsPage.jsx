import React, { useState, useMemo } from "react";
import axios from "axios";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "7px 11px", fontSize: 12 }}>
        {label && <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>{label}</p>}
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || "#d8d9da", fontWeight: 600 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AlertsPage({ alerts, soarLogs }) {
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolving, setResolving] = useState(null);

  const filtered = useMemo(() => {
    return alerts
      .filter(a => {
        const matchSearch = !search ||
          (a.type || "").toLowerCase().includes(search.toLowerCase()) ||
          (a.message || "").toLowerCase().includes(search.toLowerCase()) ||
          (a.source || "").toLowerCase().includes(search.toLowerCase());
        const matchSev = sevFilter === "All" || a.severity === sevFilter;
        const matchStatus = statusFilter === "All" || (a.status || "Open") === statusFilter;
        return matchSearch && matchSev && matchStatus;
      })
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4));
  }, [alerts, search, sevFilter, statusFilter]);

  const handleResolve = async (alert) => {
    setResolving(alert._id);
    try {
      await axios.put(`http://localhost:5000/api/alerts/${alert._id}`);
    } catch (e) {
      console.error(e);
    }
    setResolving(null);
  };

  const getSeverityClass = (sev) => {
    const map = { Critical: "badge-critical", High: "badge-high", Medium: "badge-medium", Low: "badge-low" };
    return map[sev] || "badge-info";
  };

  const stats = useMemo(() => ({
    critical: alerts.filter(a => a.severity === "Critical").length,
    high:     alerts.filter(a => a.severity === "High").length,
    medium:   alerts.filter(a => a.severity === "Medium").length,
    low:      alerts.filter(a => a.severity === "Low").length,
    open:     alerts.filter(a => !a.status || a.status === "Open").length,
    resolved: alerts.filter(a => a.status === "Resolved").length,
  }), [alerts]);

  const barData = [
    { name: "Critical", value: stats.critical, fill: "#f2495c" },
    { name: "High",     value: stats.high,     fill: "#ff7800" },
    { name: "Medium",   value: stats.medium,   fill: "#f2c94c" },
    { name: "Low",      value: stats.low,      fill: "#73bf69" },
  ];

  const SEVERITY_DOT = { Critical: "#f2495c", High: "#ff7800", Medium: "#f2c94c", Low: "#73bf69" };

  return (
    <div className="fade-in">
      {/* ── STAT PANELS ── */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "Total Alerts", value: alerts.length, colorClass: "orange" },
          { label: "Open",         value: stats.open,    colorClass: "yellow" },
          { label: "Critical",     value: stats.critical, colorClass: "red" },
          { label: "Resolved",     value: stats.resolved, colorClass: "green" },
        ].map(s => (
          <div key={s.label} className={`stat-panel ${s.colorClass}`}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── TWO COLUMN LAYOUT ── */}
      <div className="panel-grid grid-60-40">
        {/* Left: Alert Table */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">🚨</span>
              Security Alerts
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} results</span>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="search-bar" style={{ flex: 1, minWidth: 180 }}>
              <span style={{ color: "var(--text-muted)" }}>🔍</span>
              <input
                placeholder="Search type, message, source..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
              {["All", "Critical", "High", "Medium", "Low"].map(v => <option key={v}>{v}</option>)}
            </select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              {["All", "Open", "Resolved"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="panel-body no-pad scroll" style={{ maxHeight: 480 }}>
            {filtered.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 14 }}>Type</th>
                    <th>Severity</th>
                    <th>Message</th>
                    <th>Source</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((alert, i) => (
                    <tr
                      key={alert._id || i}
                      onClick={() => setSelectedAlert(alert)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ color: "var(--text-primary)", fontWeight: 500, paddingLeft: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_DOT[alert.severity] || "#5a6478", flexShrink: 0 }} />
                          {alert.type || "—"}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getSeverityClass(alert.severity)}`}>{alert.severity || "—"}</span>
                      </td>
                      <td style={{ maxWidth: 180, color: "var(--text-secondary)" }}>{alert.message || "—"}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{alert.source || alert.systemName || "—"}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(alert.createdAt || alert.timestamp).toLocaleTimeString()}
                      </td>
                      <td>
                        <span className={`badge ${alert.status === "Resolved" ? "badge-success" : "badge-muted"}`}>
                          {alert.status || "Open"}
                        </span>
                      </td>
                      <td>
                        {alert.status !== "Resolved" && (
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={e => { e.stopPropagation(); handleResolve(alert); }}
                            disabled={resolving === alert._id}
                          >
                            {resolving === alert._id ? "…" : "Resolve"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <p>No alerts match your filters</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Severity Bar Chart */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><span className="panel-title-icon">📊</span>Severity Breakdown</div>
            </div>
            <div className="panel-body" style={{ padding: "10px 4px 6px 0" }}>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={barData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={22} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alert Detail Panel */}
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">
              <div className="panel-title"><span className="panel-title-icon">🔎</span>Alert Details</div>
            </div>
            <div className="panel-body">
              {selectedAlert ? (
                <div>
                  <div style={{
                    padding: "10px 12px",
                    background: "rgba(255,140,0,0.05)",
                    border: "1px solid rgba(255,140,0,0.15)",
                    borderLeft: "3px solid var(--accent-orange)",
                    borderRadius: 3,
                    marginBottom: 12
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                      {selectedAlert.type}
                    </div>
                    <span className={`badge ${getSeverityClass(selectedAlert.severity)}`}>{selectedAlert.severity}</span>
                  </div>

                  {[
                    { label: "Message",  value: selectedAlert.message },
                    { label: "Source",   value: selectedAlert.source || selectedAlert.systemName || "—" },
                    { label: "Status",   value: selectedAlert.status || "Open" },
                    { label: "Detected", value: new Date(selectedAlert.createdAt || selectedAlert.timestamp).toLocaleString() },
                    { label: "IP",       value: selectedAlert.ip || selectedAlert.sourceIP || "—" },
                  ].map(row => (
                    <div key={row.label} className="mini-stat-row">
                      <div className="mini-stat-key">{row.label}</div>
                      <div className="mini-stat-val" style={{ fontSize: 12 }}>{row.value}</div>
                    </div>
                  ))}

                  {selectedAlert.status !== "Resolved" && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
                      onClick={() => handleResolve(selectedAlert)}
                    >
                      ✅ Mark as Resolved
                    </button>
                  )}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "20px 0" }}>
                  <div className="empty-icon" style={{ fontSize: 28 }}>👆</div>
                  <p>Click an alert to view details</p>
                </div>
              )}
            </div>
          </div>

          {/* SOAR Actions */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><span className="panel-title-icon">🤖</span>SOAR Actions</div>
              <span className="badge badge-success" style={{ fontSize: 10 }}>{soarLogs.length} total</span>
            </div>
            <div className="panel-body no-pad scroll" style={{ maxHeight: 180 }}>
              {soarLogs.slice(0, 6).length > 0 ? soarLogs.slice(0, 6).map((log, i) => (
                <div key={i} className="action-panel" style={{ margin: "6px 8px" }}>
                  <div className="action-panel-title">⚡ {log.action || "Automated Response"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                    IP: <span className="ip-badge">{log.ip || log.sourceIP || "—"}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                    {new Date(log.createdAt || log.timestamp || Date.now()).toLocaleString()}
                  </div>
                </div>
              )) : (
                <div className="empty-state" style={{ padding: "14px 0" }}><p>No SOAR actions yet</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
