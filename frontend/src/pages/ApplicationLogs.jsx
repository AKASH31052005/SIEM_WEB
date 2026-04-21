import React, { useState, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "7px 11px", fontSize: 12 }}>
        <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || "#5794f2", fontWeight: 600 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ApplicationLogs({ logs, totalCount }) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");

  const combinedLogs = useMemo(() => {
    return logs.filter(l =>
      (l.logType || l.LogType || "").toLowerCase() === "application" ||
      (l.logType || l.LogType || "").toLowerCase() === "database"
    );
  }, [logs]);

  const filtered = useMemo(() =>
    combinedLogs.filter(l => {
      const matchSearch = !search ||
        (l.message || l.Message || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.service || l.source || l.MachineName || "").toLowerCase().includes(search.toLowerCase());
      const matchLevel = levelFilter === "All" ||
        (l.level || l.Level || l.severity || "").toLowerCase() === levelFilter.toLowerCase();
      return matchSearch && matchLevel;
    }),
    [combinedLogs, search, levelFilter]
  );

  const stats = useMemo(() => ({
    total: combinedLogs.length,
    errors: combinedLogs.filter(l => (l.level || l.Level || l.severity || "").toLowerCase().includes("error") || (l.level || l.Level || l.severity || "").toLowerCase().includes("critical")).length,
    warnings: combinedLogs.filter(l => (l.level || l.Level || l.severity || "").toLowerCase().includes("warn")).length,
    info: combinedLogs.filter(l => (l.level || l.Level || l.severity || "").toLowerCase().includes("info")).length,
  }), [combinedLogs]);

  const barData = [
    { name: "Errors",   value: stats.errors,   fill: "#f2495c" },
    { name: "Warnings", value: stats.warnings, fill: "#ff7800" },
    { name: "Info",     value: stats.info,     fill: "#73bf69" },
  ];

  const liveStatus = useMemo(() => {
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;
    const fiveMinutes = 5 * 60 * 1000;

    let latestTs = null;
    let recent2m = 0;
    let recent5m = 0;
    let recentErrors = 0;
    let recentApiSignals = 0;

    combinedLogs.forEach((log) => {
      const ts = new Date(log.timestamp || log.TimeCreated || log.createdAt).getTime();
      if (!Number.isFinite(ts)) return;

      if (latestTs === null || ts > latestTs) {
        latestTs = ts;
      }

      const age = now - ts;
      if (age <= fiveMinutes) {
        recent5m += 1;

        const level = String(log.level || log.Level || log.severity || "").toLowerCase();
        if (level.includes("error") || level.includes("critical")) {
          recentErrors += 1;
        }

        const sourceBlob = [
          log.service,
          log.source,
          log.endpoint,
          log.event_category,
          log.message,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (
          sourceBlob.includes("api") ||
          sourceBlob.includes("http") ||
          sourceBlob.includes("/v1") ||
          sourceBlob.includes("/v2")
        ) {
          recentApiSignals += 1;
        }
      }

      if (age <= twoMinutes) {
        recent2m += 1;
      }
    });

    const minutesSinceLast = latestTs === null ? null : Math.floor((now - latestTs) / 60000);

    return {
      recent5m,
      recentErrors,
      recentApiSignals,
      minutesSinceLast,
      ingestState: recent2m > 0 ? "connected" : recent5m > 0 ? "lagging" : "offline",
      errorState: recentErrors >= 5 ? "spike" : recentErrors > 0 ? "active" : "quiet",
      apiState: recentApiSignals > 0 ? "active" : "idle",
    };
  }, [combinedLogs]);

  const getLevelBadge = (level) => {
    const l = (level || "").toLowerCase();
    if (l.includes("error") || l.includes("critical")) return "badge-critical";
    if (l.includes("warn")) return "badge-medium";
    if (l.includes("info")) return "badge-info";
    return "badge-muted";
  };

  return (
    <div className="fade-in">
      <div style={{ padding: "0 2px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-info" style={{ fontSize: 10 }}>⚙️ APP & DB EVENTS</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(totalCount ?? combinedLogs.length).toLocaleString()} total logged events</span>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "Total Events", value: totalCount ?? stats.total, colorClass: "blue" },
          { label: "Errors",       value: stats.errors, colorClass: "red" },
          { label: "Warnings",     value: stats.warnings, colorClass: "orange" },
          { label: "Info",         value: stats.info, colorClass: "green" },
        ].map(s => (
          <div key={s.label} className={`stat-panel ${s.colorClass}`}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="panel-grid grid-70-30">
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel-header">
            <div className="panel-title"><span className="panel-title-icon">⚙️</span> Application Event Feed</div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} matched</span>
          </div>

          <div className="toolbar">
            <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>🔍</span>
              <input placeholder="Search logs, queries..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
              {["All", "Error", "Warning", "Info", "Critical"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          <div className="panel-body no-pad scroll" style={{ maxHeight: 520 }}>
            {filtered.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 14 }}>Time</th>
                    <th>Level</th>
                    <th>Service / Source</th>
                    <th>Event ID</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((log, i) => (
                    <tr key={log._id || i}>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)", paddingLeft: 14 }}>
                        {new Date(log.timestamp || log.TimeCreated || log.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${getLevelBadge(log.level || log.Level || log.severity)}`}>
                          {log.level || log.Level || log.severity || "—"}
                        </span>
                      </td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--accent-cyan)" }}>
                        {log.service || log.source || log.MachineName || log.event_category || log.endpoint || "—"}
                      </td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-disabled)" }}>
                        {log.eventId || log.EventID || log.status_code || log.method || "—"}
                      </td>
                      <td style={{ maxWidth: 380, color: "var(--text-primary)" }}>
                        {(log.message || log.Message || "—").substring(0, 160)}
                        {(log.message || log.Message || "").length > 160 ? "…" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">⚙️</div>
                <p>No application logs found</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Verify application logging services</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><span className="panel-title-icon">📊</span> Severity Distribution</div>
            </div>
            <div className="panel-body" style={{ padding: "10px 4px 6px 0" }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">
              <div className="panel-title"><span className="panel-title-icon">🔗</span> Live Stream Status</div>
            </div>
            <div className="panel-body">
              <div className="mini-stat-row">
                <div className="mini-stat-key" style={{ color: "var(--accent-orange)" }}>App Event Ingest</div>
                <div className="mini-stat-val" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: liveStatus.ingestState === "offline" ? "var(--severity-critical)" : liveStatus.ingestState === "lagging" ? "var(--severity-high)" : "var(--accent-green)" }}>
                  <div
                    className="status-dot"
                    style={{
                      background:
                        liveStatus.ingestState === "offline"
                          ? "var(--severity-critical)"
                          : liveStatus.ingestState === "lagging"
                            ? "var(--severity-high)"
                            : "var(--accent-green)",
                      animation: liveStatus.ingestState === "offline" ? "none" : undefined,
                    }}
                  />
                  {liveStatus.ingestState === "connected" ? "Connected" : liveStatus.ingestState === "lagging" ? "Lagging" : "Offline"}
                </div>
              </div>
              <div className="mini-stat-row">
                <div className="mini-stat-key" style={{ color: "var(--accent-cyan)" }}>Error Channel (5m)</div>
                <div className="mini-stat-val" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: liveStatus.errorState === "spike" ? "var(--severity-critical)" : liveStatus.errorState === "active" ? "var(--severity-high)" : "var(--text-muted)" }}>
                  <div
                    className="status-dot"
                    style={{
                      background:
                        liveStatus.errorState === "spike"
                          ? "var(--severity-critical)"
                          : liveStatus.errorState === "active"
                            ? "var(--severity-high)"
                            : "var(--text-disabled)",
                      animation: liveStatus.errorState === "quiet" ? "none" : undefined,
                    }}
                  />
                  {liveStatus.errorState === "spike" ? "Spike" : liveStatus.errorState === "active" ? "Active" : "Quiet"} ({liveStatus.recentErrors})
                </div>
              </div>
              <div className="mini-stat-row" style={{ borderBottom: "none" }}>
                <div className="mini-stat-key" style={{ color: "var(--accent-purple)" }}>External/API Signals</div>
                <div className="mini-stat-val" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: liveStatus.apiState === "active" ? "var(--accent-cyan)" : "var(--text-muted)" }}>
                  <div
                    className="status-dot"
                    style={{
                      background: liveStatus.apiState === "active" ? "var(--accent-cyan)" : "var(--text-disabled)",
                      animation: liveStatus.apiState === "active" ? undefined : "none",
                    }}
                  />
                  {liveStatus.apiState === "active" ? "Active" : "Idle"} ({liveStatus.recentApiSignals})
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-muted)" }}>
                Last event: {liveStatus.minutesSinceLast == null ? "no data yet" : `${liveStatus.minutesSinceLast} min ago`} | {liveStatus.recent5m} events in last 5m
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
