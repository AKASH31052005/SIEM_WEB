import React, { useState, useMemo } from "react";

export default function LogsPage({ logs }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sevFilter, setSevFilter] = useState("All");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const logTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.logType || l.LogType || "Unknown"));
    return ["All", ...types];
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = !search ||
        (l.message || l.Message || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.systemName || l.MachineName || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.logType || l.LogType || "").toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "All" || (l.logType || l.LogType) === typeFilter;
      const matchSev = sevFilter === "All" || l.severity === sevFilter;
      return matchSearch && matchType && matchSev;
    });
  }, [logs, search, typeFilter, sevFilter]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const getSeverityClass = (sev) => {
    const map = {
      Critical: "badge-critical", High: "badge-high", Medium: "badge-medium",
      Low: "badge-low", Error: "badge-high", Warning: "badge-medium", Information: "badge-info"
    };
    return map[sev] || "badge-info";
  };

  // Quick stats
  const logStats = useMemo(() => {
    const types = {};
    logs.forEach(l => {
      const t = l.logType || l.LogType || "Unknown";
      types[t] = (types[t] || 0) + 1;
    });
    return Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [logs]);

  return (
    <div className="fade-in">
      {/* ── STAT PANELS ── */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "Total Events",   value: logs.length.toLocaleString(),    colorClass: "blue" },
          { label: "Filtered",       value: filtered.length.toLocaleString(), colorClass: "orange" },
          { label: "Page",           value: `${page + 1} / ${totalPages || 1}`, colorClass: "green" },
          { label: "Log Sources",    value: new Set(logs.map(l => l.systemName || l.MachineName).filter(Boolean)).size, colorClass: "purple" },
        ].map(s => (
          <div key={s.label} className={`stat-panel ${s.colorClass}`}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.colorClass}`} style={{ fontSize: typeof s.value === "string" && s.value.length > 6 ? 20 : 30 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN LOG PANEL ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-title-icon">📁</span>
            Unified Log Stream
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {logStats.map(([type, count]) => (
              <span key={type} className="badge badge-muted" style={{ fontSize: 10 }}>
                {type}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>🔍</span>
            <input
              placeholder="Search message, system, log type..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <select className="filter-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
            {logTypes.map(v => <option key={v}>{v}</option>)}
          </select>
          <select className="filter-select" value={sevFilter} onChange={e => { setSevFilter(e.target.value); setPage(0); }}>
            {["All", "Critical", "High", "Medium", "Low", "Error", "Warning", "Information"].map(v =>
              <option key={v}>{v}</option>
            )}
          </select>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {filtered.length.toLocaleString()} events
          </span>
        </div>

        {/* Table */}
        <div className="panel-body no-pad scroll" style={{ maxHeight: 520 }}>
          {paginated.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Time</th>
                  <th style={{ width: 120 }}>System</th>
                  <th style={{ width: 90 }}>Type</th>
                  <th style={{ width: 70 }}>Event ID</th>
                  <th style={{ width: 90 }}>Severity</th>
                  <th>Message</th>
                  <th style={{ width: 110 }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((log, i) => (
                  <tr key={log._id || i}>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)" }}>
                      {new Date(log.timestamp || log.TimeCreated || log.createdAt).toLocaleTimeString()}
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                      <span style={{ color: "var(--accent-cyan)" }}>
                        {log.systemName || log.MachineName || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: 10 }}>
                        {log.logType || log.LogType || "—"}
                      </span>
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-muted)" }}>
                      {log.eventId || log.EventID || "—"}
                    </td>
                    <td>
                      {(log.severity || log.Level) && (
                        <span className={`badge ${getSeverityClass(log.severity || log.Level)}`}>
                          {log.severity || log.Level}
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-primary)", maxWidth: 340 }}>
                      {(log.message || log.Message || "—").substring(0, 140)}
                      {(log.message || log.Message || "").length > 140 ? "…" : ""}
                    </td>
                    <td>
                      {(log.sourceIP || log.SourceIP || log.ip) && (
                        <span className="ip-badge">{log.sourceIP || log.SourceIP || log.ip}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <p>No logs match your search</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-outline btn-xs" disabled={page === 0} onClick={() => setPage(0)}>«</button>
            <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", padding: "0 10px" }}>
              {page + 1} / {totalPages}
            </span>
            <button className="btn btn-outline btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
            <button className="btn btn-outline btn-xs" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
          </div>
        )}
      </div>
    </div>
  );
}
