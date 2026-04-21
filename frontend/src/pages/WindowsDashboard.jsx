import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const EVENT_DESCRIPTIONS = {
  41: "System Unexpected Restart",
  1102: "Audit Log Cleared",
  4624: "Successful Logon",
  4625: "Failed Logon",
  4634: "Logoff",
  4647: "User Initiated Logoff",
  4648: "Explicit Credentials Logon",
  4672: "Admin Logon / Privilege Escalation",
  4688: "Process Created",
  4697: "Service Installed",
  4720: "User Account Created",
  4726: "User Account Deleted",
  4732: "Member Added to Group",
  4740: "Account Locked Out",
  6005: "System Startup",
  6006: "System Shutdown",
  7045: "Service Installed",
};

const CRITICAL_EVENT_IDS = new Set([4625, 4740, 1102]);
const HIGH_EVENT_IDS = new Set([4672, 4720, 4726, 4688]);
const SECURITY_CARD_EVENT_IDS = [4624, 4625, 4672, 4720, 4740, 4688];

const LEVEL_COLORS = {
  Information: "#5794f2",
  Warning: "#f2c94c",
  Error: "#ff7800",
  Critical: "#f2495c",
  Unknown: "#8e99a8",
};

const SEV_COLOR_MAP = {
  4625: "#f2495c",
  4740: "#f2495c",
  4672: "#ff7800",
  4720: "#f2c94c",
};

function toEventId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toEventLabel(value) {
  if (value === null || value === undefined || value === "") return "?";
  const id = toEventId(value);
  return id === null ? String(value) : String(id);
}

function toTimestampMs(value) {
  const date = value ? new Date(value) : null;
  if (!date) return 0;
  const ms = date.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function normalizeLevel(value) {
  const source = String(value || "").toLowerCase();
  if (!source) return "Unknown";
  if (source.includes("critical")) return "Critical";
  if (source.includes("error")) return "Error";
  if (source.includes("warn")) return "Warning";
  if (source.includes("info")) return "Information";
  return String(value);
}

function formatTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString();
}

function eventSeverityColor(eventId) {
  if (CRITICAL_EVENT_IDS.has(eventId)) return "#f2495c";
  if (HIGH_EVENT_IDS.has(eventId)) return "#ff7800";
  return "#5794f2";
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: "#1a1d24",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 4,
        padding: "7px 11px",
        fontSize: 12,
      }}
    >
      {label ? (
        <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>
          Event {label}
        </p>
      ) : null}
      {payload.map((item, index) => (
        <p
          key={`${item.name}-${index}`}
          style={{ color: item.color || item.fill || "#5794f2", fontWeight: 600 }}
        >
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
};

export default function WindowsDashboard({ logs = [], totalCount }) {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");

  const windowsLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];

    return logs
      .map((log, index) => {
        const eventValue = log.EventID ?? log.eventId;
        const eventId = toEventId(eventValue);
        const eventIdLabel = toEventLabel(eventValue);
        const timestamp = log.TimeCreated || log.timestamp || log.createdAt || null;

        return {
          ...log,
          stableId:
            log._id ||
            `${eventIdLabel}|${timestamp || ""}|${log.Message || log.message || ""}|${index}`,
          eventId,
          eventIdLabel,
          level: normalizeLevel(log.Level || log.level),
          machineName: log.MachineName || log.machineName || "unknown",
          username: log.Username || log.username || "unknown",
          sourceIp: log.SourceIP || log.sourceIP || "unknown",
          message: log.Message || log.message || "",
          timestamp,
          timestampMs: toTimestampMs(timestamp),
        };
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [logs]);

  const eventCounts = useMemo(() => {
    const counts = {};
    windowsLogs.forEach((log) => {
      counts[log.eventIdLabel] = (counts[log.eventIdLabel] || 0) + 1;
    });
    return counts;
  }, [windowsLogs]);

  const eventIds = useMemo(() => {
    const raw = Object.keys(eventCounts);
    raw.sort((a, b) => {
      const aNum = Number.parseInt(a, 10);
      const bNum = Number.parseInt(b, 10);
      const aIsNum = Number.isFinite(aNum);
      const bIsNum = Number.isFinite(bNum);
      if (aIsNum && bIsNum) return aNum - bNum;
      if (aIsNum) return -1;
      if (bIsNum) return 1;
      return a.localeCompare(b);
    });
    return ["All", ...raw];
  }, [eventCounts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return windowsLogs.filter((log) => {
      const searchTarget = [
        log.message,
        log.eventIdLabel,
        log.level,
        log.machineName,
        log.username,
        log.sourceIp,
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch = !query || searchTarget.includes(query);
      const matchEvent = eventFilter === "All" || log.eventIdLabel === eventFilter;
      const matchLevel = levelFilter === "All" || log.level === levelFilter;
      return matchSearch && matchEvent && matchLevel;
    });
  }, [windowsLogs, search, eventFilter, levelFilter]);

  const eventChart = useMemo(() => {
    return Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id, count]) => ({
        id: `E${id}`,
        eventIdLabel: id,
        count,
        name: EVENT_DESCRIPTIONS[id] || `Event ${id}`,
      }));
  }, [eventCounts]);

  const securityCounts = useMemo(() => {
    return SECURITY_CARD_EVENT_IDS.map((id) => ({
      id,
      label: EVENT_DESCRIPTIONS[id],
      count: windowsLogs.filter((log) => log.eventId === id).length,
    }));
  }, [windowsLogs]);

  const topMachines = useMemo(() => {
    const counts = {};
    windowsLogs.forEach((log) => {
      counts[log.machineName] = (counts[log.machineName] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [windowsLogs]);

  const topUsers = useMemo(() => {
    const counts = {};
    windowsLogs.forEach((log) => {
      const user = log.username === "NT AUTHORITY\\SYSTEM" ? "SYSTEM" : log.username;
      counts[user] = (counts[user] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [windowsLogs]);

  const levelPie = useMemo(() => {
    const counts = {};
    windowsLogs.forEach((log) => {
      counts[log.level] = (counts[log.level] || 0) + 1;
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      color: LEVEL_COLORS[name] || LEVEL_COLORS.Unknown,
    }));
  }, [windowsLogs]);

  const eventKeyRows = useMemo(() => {
    return Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([id, count]) => {
        const numericId = toEventId(id);
        return {
          id,
          count,
          description: EVENT_DESCRIPTIONS[id] || `Event ${id}`,
          color: eventSeverityColor(numericId),
        };
      });
  }, [eventCounts]);

  const latestEventText = windowsLogs[0]?.timestamp
    ? new Date(windowsLogs[0].timestamp).toLocaleString()
    : "No data yet";

  const getLevelBadge = (level) => {
    if (!level) return "badge-muted";
    const normalized = String(level).toLowerCase();
    if (normalized.includes("critical") || normalized.includes("error")) return "badge-critical";
    if (normalized.includes("warning")) return "badge-medium";
    if (normalized.includes("info")) return "badge-info";
    return "badge-muted";
  };

  return (
    <div className="fade-in">
      <div
        style={{
          padding: "0 2px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-info" style={{ fontSize: 10 }}>
            WINDOWS SECURITY
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {(totalCount ?? windowsLogs.length).toLocaleString()} total events indexed
          </span>
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Last event: {latestEventText}
        </span>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {securityCounts.map((eventCard) => {
          const countColor = SEV_COLOR_MAP[eventCard.id] || "var(--accent-blue)";
          return (
            <div
              key={eventCard.id}
              className="stat-panel"
              style={{ padding: "12px", borderTop: `2px solid ${countColor}` }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontFamily: "JetBrains Mono, monospace",
                  marginBottom: 4,
                }}
              >
                ID: {eventCard.id}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: countColor,
                  marginBottom: 4,
                  lineHeight: 1,
                }}
              >
                {eventCard.count}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.2 }}>
                {eventCard.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel-grid grid-50-50">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">📊</span> Event ID Distribution
            </div>
          </div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={eventChart} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="id" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {eventChart.map((entry, index) => (
                    <Cell key={`event-bar-${entry.eventIdLabel}-${index}`} fill={eventSeverityColor(toEventId(entry.eventIdLabel))} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">🧭</span> Severity Level Distribution
            </div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie
                  data={levelPie}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {levelPie.map((entry, index) => (
                    <Cell key={`level-pie-${entry.name}-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel-grid grid-3">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">🖥️</span> Top Machines
            </div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topMachines.length ? (
              topMachines.map(([machine, count], index) => (
                <div key={machine} className="metric-row">
                  <span style={{ fontSize: 10, minWidth: 16 }}>{index + 1}</span>
                  <span className="metric-label" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {machine}
                  </span>
                  <span className="metric-val">{count}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No machine data</p>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">👤</span> Top Users
            </div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {topUsers.length ? (
              topUsers.map(([user, count], index) => (
                <div key={user} className="metric-row">
                  <span style={{ fontSize: 10, minWidth: 16 }}>{index + 1}</span>
                  <span className="metric-label">{user}</span>
                  <span className="metric-val">{count}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No user data</p>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-icon">🔐</span> Security Event Keys
            </div>
          </div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 200 }}>
            {eventKeyRows.length ? (
              eventKeyRows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span className="ip-badge" style={{ flexShrink: 0, width: 52, textAlign: "center", borderColor: row.color }}>
                    {row.id}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>{row.description}</span>
                  <span className="metric-val" style={{ minWidth: 28, textAlign: "right" }}>
                    {row.count}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No event keys</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-title-icon">📋</span> Windows Event Feed
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} matched</span>
        </div>

        <div
          className="toolbar"
          style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: "10px" }}
        >
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <span>🔍</span>
            <input
              placeholder="Search message, machine, user, source IP or Event ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className="filter-select" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
            {eventIds.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select className="filter-select" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
            {["All", "Information", "Warning", "Error", "Critical", "Unknown"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>

        <div className="panel-body no-pad scroll" style={{ maxHeight: 400 }}>
          {filtered.length ? (
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
                {filtered.slice(0, 120).map((log, index) => (
                  <tr key={`${log.stableId}-${index}`}>
                    <td
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 10,
                        color: "var(--text-muted)",
                        paddingLeft: 14,
                      }}
                    >
                      {formatTime(log.timestamp)}
                    </td>
                    <td>
                      <span className="ip-badge">{log.eventIdLabel}</span>
                    </td>
                    <td>
                      <span className={`badge ${getLevelBadge(log.level)}`}>{log.level}</span>
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--accent-cyan)" }}>
                      {log.machineName}
                    </td>
                    <td style={{ fontSize: 11 }}>{log.username}</td>
                    <td>
                      <span className="ip-badge">{log.sourceIp}</span>
                    </td>
                    <td style={{ maxWidth: 320, color: "var(--text-primary)" }}>
                      {log.message.slice(0, 110)}
                      {log.message.length > 110 ? "..." : ""}
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
