import React, { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const SEVERITY_COLORS = {
  Critical: "#f2495c",
  High:     "#ff7800",
  Medium:   "#f2c94c",
  Low:      "#73bf69",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#1a1d24",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 4,
        padding: "8px 12px",
        fontSize: 12,
        color: "#d8d9da",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
      }}>
        {label && <p style={{ color: "#9fa7b3", marginBottom: 4, fontSize: 11 }}>{label}</p>}
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontWeight: 600, margin: "2px 0" }}>
            <span style={{ color: "#9fa7b3", fontWeight: 400 }}>{p.name}: </span>{p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function StatPanel({ label, value, colorClass, icon, subtext, change }) {
  return (
    <div className={`stat-panel ${colorClass} fade-in-up`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${colorClass}`}>{value}</div>
      {subtext && <div className="stat-subtext">{subtext}</div>}
      {change !== undefined && (
        <div className={`stat-change ${change >= 0 ? "up" : "down"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change)} from last hour
        </div>
      )}
    </div>
  );
}

export default function Overview({ alerts, logs, soarLogs }) {
  const stats = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.severity === "Critical").length,
    high: alerts.filter(a => a.severity === "High").length,
    medium: alerts.filter(a => a.severity === "Medium").length,
    low: alerts.filter(a => a.severity === "Low").length,
    resolved: alerts.filter(a => a.status === "Resolved").length,
    open: alerts.filter(a => !a.status || a.status === "Open").length,
    totalLogs: logs.length,
    blockedIPs: soarLogs.length,
  }), [alerts, logs, soarLogs]);

  // Severity bar distribution widths
  const totalSev = stats.critical + stats.high + stats.medium + stats.low || 1;

  // Severity pie chart
  const severityData = useMemo(() => [
    { name: "Critical", value: stats.critical, color: "#f2495c" },
    { name: "High",     value: stats.high,     color: "#ff7800" },
    { name: "Medium",   value: stats.medium,   color: "#f2c94c" },
    { name: "Low",      value: stats.low,       color: "#73bf69" },
  ].filter(d => d.value > 0), [stats]);

  // Alert trend — 12h hourly buckets
  const alertTrend = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const hourAgo = now - (11 - i) * 3600000;
      const label = new Date(hourAgo).toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false
      });
      return { time: label, Critical: 0, High: 0, Medium: 0 };
    });
    alerts.forEach(a => {
      const ts = new Date(a.createdAt || a.timestamp).getTime();
      const hoursAgo = Math.floor((now - ts) / 3600000);
      if (hoursAgo >= 0 && hoursAgo < 12) {
        const idx = 11 - hoursAgo;
        if (buckets[idx] && a.severity) buckets[idx][a.severity] = (buckets[idx][a.severity] || 0) + 1;
      }
    });
    return buckets;
  }, [alerts]);

  // Log type distribution
  const logTypeData = useMemo(() => {
    const types = {};
    logs.forEach(l => {
      const t = l.logType || l.LogType || "Unknown";
      types[t] = (types[t] || 0) + 1;
    });
    return Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [logs]);

  // Top Alert Types
  const topAlertTypes = useMemo(() => {
    const types = {};
    alerts.forEach(a => { const t = a.type || "Unknown"; types[t] = (types[t] || 0) + 1; });
    return Object.entries(types).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [alerts]);

  // Recent critical/high alerts
  const recentAlerts = useMemo(() =>
    alerts
      .filter(a => ["Critical", "High"].includes(a.severity))
      .slice(0, 10),
    [alerts]
  );

  const resolutionRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const soarCoverage = stats.total > 0 ? Math.min(100, Math.round((stats.blockedIPs / stats.total) * 100)) : 0;

  return (
    <div className="fade-in">
      {/* ── STAT PANELS ROW ── */}
      <div className="stat-grid">
        <StatPanel
          label="Total Alerts"
          value={stats.total}
          colorClass="orange"
          icon="🚨"
          subtext={`${stats.open} open`}
        />
        <StatPanel
          label="Critical Alerts"
          value={stats.critical}
          colorClass="red"
          icon="🔴"
          subtext={`${stats.high} high severity`}
        />
        <StatPanel
          label="Log Events"
          value={stats.totalLogs.toLocaleString()}
          colorClass="blue"
          icon="📋"
          subtext="ingested"
        />
        <StatPanel
          label="SOAR Actions"
          value={stats.blockedIPs}
          colorClass="green"
          icon="🤖"
          subtext="automated responses"
        />
      </div>

      {/* ── SEVERITY DISTRIBUTION BAR ── */}
      <div className="severity-bar-row" style={{ marginBottom: 8 }}>
        {stats.critical > 0 && (
          <div className="severity-bar-seg" style={{ width: `${(stats.critical / totalSev) * 100}%`, background: "#f2495c" }} title={`Critical: ${stats.critical}`} />
        )}
        {stats.high > 0 && (
          <div className="severity-bar-seg" style={{ width: `${(stats.high / totalSev) * 100}%`, background: "#ff7800" }} title={`High: ${stats.high}`} />
        )}
        {stats.medium > 0 && (
          <div className="severity-bar-seg" style={{ width: `${(stats.medium / totalSev) * 100}%`, background: "#f2c94c" }} title={`Medium: ${stats.medium}`} />
        )}
        {stats.low > 0 && (
          <div className="severity-bar-seg" style={{ width: `${(stats.low / totalSev) * 100}%`, background: "#73bf69" }} title={`Low: ${stats.low}`} />
        )}
      </div>

      {/* ── ROW 1: Alert Trend (70%) + Severity Donut (30%) ── */}
      <div className="panel-grid grid-70-30" style={{ marginBottom: 8 }}>
        {/* Alert Trend Chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">📈</span>
              Alert Trend — Last 12 Hours
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Critical", "High", "Medium"].map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: SEVERITY_COLORS[s] }} />
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={alertTrend} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gCritical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f2495c" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f2495c" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ff7800" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ff7800" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f2c94c" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f2c94c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Critical" stroke="#f2495c" fill="url(#gCritical)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="High"     stroke="#ff7800" fill="url(#gHigh)"     strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="Medium"   stroke="#f2c94c" fill="url(#gMed)"      strokeWidth={1}   dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Donut */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">🎯</span>
              Severity Distribution
            </div>
          </div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {severityData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%" cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {severityData.map((entry, i) => (
                         <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
                  {severityData.map(d => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: d.color, fontFamily: "JetBrains Mono, monospace" }}>{d.value}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {Math.round((d.value / stats.total) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state"><div className="empty-icon">✅</div><p>No active alerts</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Active Threat Feed (60%) + Panel stack (40%) ── */}
      <div className="panel-grid grid-60-40">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">🚨</span>
              Active Threats
            </div>
            <span className="badge badge-critical" style={{ fontSize: 10 }}>
              {recentAlerts.filter(a => !a.status || a.status === "Open").length} OPEN
            </span>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 320 }}>
            {recentAlerts.length > 0 ? recentAlerts.map((alert, i) => (
              <div key={alert._id || i} className="alert-item">
                <div className="alert-dot" style={{ backgroundColor: SEVERITY_COLORS[alert.severity] || "#5a6478" }} />
                <div className="alert-content">
                  <div className="alert-type">{alert.type || "Unknown Threat"}</div>
                  <div className="alert-meta">
                    <span>{alert.message || "—"}</span>
                  </div>
                  <div className="alert-meta" style={{ marginTop: 4 }}>
                    <span className={`badge badge-${(alert.severity || "low").toLowerCase()}`}>{alert.severity}</span>
                    <span>{alert.source || alert.systemName || "—"}</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
                      {new Date(alert.createdAt || alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="empty-state"><div className="empty-icon">🛡️</div><p>No active threats detected</p></div>
            )}
          </div>
        </div>

        {/* Right-side stacked panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Top Alert Types */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><span className="panel-title-icon">🔝</span>Top Alert Types</div>
            </div>
            <div className="panel-body no-pad scroll" style={{ maxHeight: 150 }}>
              {topAlertTypes.map(([type, count], i) => (
                <div key={type} className="metric-row">
                  <span style={{ fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                  <span className="metric-label">{type}</span>
                  <span className="metric-val">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Log Sources Bar Chart */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><span className="panel-title-icon">📊</span>Log Sources</div>
            </div>
            <div className="panel-body" style={{ padding: "10px 6px 6px 0" }}>
              {logTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={logTypeData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#5a6478", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "#9fa7b3", fontSize: 10 }} width={70} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#5794f2" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: "14px 0" }}><p>No log data yet</p></div>
              )}
            </div>
          </div>

          {/* KPI metrics */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><span className="panel-title-icon">📉</span>SOC Metrics</div>
            </div>
            <div className="panel-body">
              <div className="metric-row">
                <span className="metric-label">Resolution</span>
                <div className="metric-bar">
                  <div className="progress-bar-wrap">
                    <div className="progress-bar green" style={{ width: `${resolutionRate}%` }} />
                  </div>
                </div>
                <span className="metric-val" style={{ color: "var(--accent-green)" }}>{resolutionRate}%</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">SOAR Cover</span>
                <div className="metric-bar">
                  <div className="progress-bar-wrap">
                    <div className="progress-bar blue" style={{ width: `${soarCoverage}%` }} />
                  </div>
                </div>
                <span className="metric-val" style={{ color: "var(--accent-cyan)" }}>{soarCoverage}%</span>
              </div>
              <div className="metric-row" style={{ marginBottom: 0 }}>
                <span className="metric-label">Open Alerts</span>
                <div className="metric-bar">
                  <div className="progress-bar-wrap">
                    <div className="progress-bar orange" style={{ width: `${stats.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0}%` }} />
                  </div>
                </div>
                <span className="metric-val" style={{ color: "var(--accent-orange)" }}>
                  {stats.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
