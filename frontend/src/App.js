import React, { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import API, { SOCKET_URL } from "./api";
import useSourceLogs from "./hooks/useSourceLogs";
import "./index.css";

import Overview from "./pages/Overview";
import AlertsPage from "./pages/AlertsPage";
import LogsPage from "./pages/LogsPage";
import NetworkPage from "./pages/NetworkPage";
import SystemMetrics from "./pages/SystemMetrics";
import WindowsDashboard from "./pages/WindowsDashboard";
import ApplicationLogs from "./pages/ApplicationLogs";
import WebDashboard from "./pages/WebDashboard";
import LinuxDashboard from "./pages/LinuxDashboard";
import DatabaseDashboard from "./pages/DatabaseDashboard";

const MAX_LOGS = 9000;
const MAX_LIVE_LOGS = 2000;
const MAX_ALERTS = 2500;
const MAX_SOAR = 800;
const DASHBOARD_POLL_INTERVAL_MS = 15000;
const WINDOWS_POLL_INTERVAL_MS = 2000;

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "SOC Dashboard", icon: "🛡️", exact: true },
      { path: "/alerts", label: "Alerts", icon: "🚨", badgeKey: "criticalAlerts", badgeColor: "red" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { path: "/system", label: "System Metrics", icon: "📊" },
      { path: "/windows", label: "Windows Events", icon: "🪟" },
      { path: "/linux", label: "Linux Events", icon: "🐧" },
      { path: "/network", label: "Network Traffic", icon: "🌐" },
      { path: "/web", label: "Web Access Logs", icon: "🌩️" },
      { path: "/application", label: "Application Logs", icon: "⚙️" },
      { path: "/database", label: "Database Audit", icon: "🗄️" },
    ],
  },
  {
    label: "Analysis",
    items: [{ path: "/logs", label: "All Logs", icon: "📁" }],
  },
];

function toEntryKey(entry) {
  return (
    entry?._id ||
    [
      entry?.source || entry?.logType || entry?.LogType || "",
      entry?.timestamp || entry?.createdAt || entry?.TimeCreated || "",
      entry?.eventId || entry?.EventID || "",
      entry?.message || entry?.Message || "",
      entry?.sourceIP || entry?.SourceIP || entry?.srcIP || entry?.ip || "",
      entry?.destIP || entry?.dst_ip || "",
      entry?.method || entry?.operation || entry?.operationType || "",
      entry?.url || entry?.endpoint || "",
    ].join("|")
  );
}

function prependUnique(list, item, max) {
  const key = toEntryKey(item);
  const next = [item, ...list.filter((entry) => toEntryKey(entry) !== key)];
  return next.slice(0, max);
}

function normalizeSeverity(value, fallback = "Low") {
  const v = String(value || "").toLowerCase();
  if (!v) return fallback;
  if (v.includes("critical")) return "Critical";
  if (v.includes("high") || v.includes("error")) return "High";
  if (v.includes("medium") || v.includes("warn")) return "Medium";
  if (v.includes("low") || v.includes("info")) return "Low";
  return fallback;
}

function inferSource(raw) {
  const explicit = String(raw?.source || raw?.logType || raw?.LogType || "").toLowerCase();
  if (explicit) return explicit;
  if (raw?.EventID || raw?.TimeCreated || raw?.MachineName) return "windows";
  if (raw?.Host || raw?.Process || raw?.Timestamp) return "linux";
  if (raw?.srcIP || raw?.destIP || raw?.sourceIP || raw?.destPort) return "network";
  if (raw?.operationType || raw?.collection || raw?.collectionName || raw?.event_category === "database") return "database";
  if (raw?.event_category || raw?.event_action || raw?.status_code || raw?.ip_address) return "application";
  if (raw?.Method || raw?.URL || raw?.StatusCode || raw?.ServerType) return "web";
  return "system";
}

function normalizeLog(raw) {
  if (!raw || typeof raw !== "object") return null;
  const source = inferSource(raw);
  const timestamp = raw.timestamp || raw.TimeCreated || raw.Timestamp || raw.createdAt || new Date().toISOString();
  const logType = raw.logType || raw.LogType || source;

  const base = {
    ...raw,
    source,
    logType,
    timestamp,
  };

  if (source === "network") {
    const action = String(base.action || "ALLOW").toUpperCase();
    return {
      ...base,
      action,
      sourceIP: base.sourceIP || base.srcIP || base.source_ip || "unknown",
      srcIP: base.srcIP || base.sourceIP || base.source_ip || "unknown",
      destIP: base.destIP || base.dst_ip || "unknown",
      severity: normalizeSeverity(base.severity || (action === "BLOCK" ? "High" : "Low"), "Low"),
    };
  }

  if (source === "web") {
    const status = Number.parseInt(base.status || base.statusCode || base.StatusCode, 10);
    const safeStatus = Number.isNaN(status) ? 0 : status;
    return {
      ...base,
      method: String(base.method || base.Method || "UNKNOWN").toUpperCase(),
      url: base.url || base.URL || base.endpoint || base.path || "/",
      status: safeStatus,
      statusCode: safeStatus,
      ip: base.ip || base.IP || "unknown",
      severity: normalizeSeverity(base.severity || (safeStatus >= 500 ? "High" : safeStatus >= 400 ? "Medium" : "Low")),
    };
  }

  if (source === "windows") {
    return {
      ...base,
      eventId: base.eventId || base.EventID || null,
      severity: normalizeSeverity(base.severity || base.Level, "Low"),
      message: base.message || base.Message || "",
      sourceIP: base.sourceIP || base.SourceIP || "unknown",
    };
  }

  if (source === "linux") {
    return {
      ...base,
      message: base.message || base.Message || "",
      severity: normalizeSeverity(base.severity || base.Status, "Low"),
      hostname: base.hostname || base.host || base.Host || "unknown",
      process: base.process || base.Process || "unknown",
    };
  }

  if (source === "application") {
    return {
      ...base,
      level: base.level || base.severity || "Info",
      severity: normalizeSeverity(base.severity || base.level, "Low"),
      message: base.message || base.Message || "",
    };
  }

  if (source === "database") {
    return {
      ...base,
      operation: base.operation || base.operationType || base.method || "unknown",
      severity: normalizeSeverity(base.severity || (base.status === "failed" ? "Critical" : "Low"), "Low"),
      message: base.message || "Database activity log",
    };
  }

  return {
    ...base,
    severity: normalizeSeverity(base.severity, "Low"),
    message: base.message || base.Message || "",
  };
}

function normalizeAlert(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    severity: normalizeSeverity(raw.severity, "Low"),
    status: raw.status || "Open",
    createdAt: raw.createdAt || raw.timestamp || new Date().toISOString(),
  };
}

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <span className="topbar-time">{time.toLocaleString("en-US", { hour12: false })}</span>;
}

function getPageTitle(pathname) {
  const map = {
    "/": "SOC Overview Dashboard",
    "/alerts": "Security Alerts",
    "/system": "System Metrics",
    "/windows": "Windows Event Logs",
    "/linux": "Linux System Logs",
    "/network": "Network Traffic Monitor",
    "/web": "Web Application Firewall",
    "/application": "Application Logs",
    "/database": "Database Activity Audit",
    "/logs": "All System Logs",
  };
  return map[pathname] || "SIEM Dashboard";
}

function AppLayout({ children, alerts }) {
  const location = useLocation();
  const criticalCount = alerts.filter((a) => a.severity === "Critical" && (a.status || "Open") !== "Resolved").length;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>✕</div>

        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛡️</div>
          <div className="sidebar-logo-text">
            <span className="brand">SecureWatch</span>
            <span className="sub">SIEM Platform</span>
          </div>
        </div>

        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            <nav className="sidebar-nav">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badgeKey === "criticalAlerts" && criticalCount > 0 && (
                    <span className="nav-badge red">{criticalCount}</span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </aside>

      <div className="main-content">
        <div className="topbar">
          <div className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</div>
          <div>{getPageTitle(location.pathname)}</div>
          <LiveClock />
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [liveLogs, setLiveLogs] = useState([]);
  const [soarLogs, setSoarLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [timeRange] = useState("all");
  const [logSummary, setLogSummary] = useState(null);

  const refreshRef = useRef(null);

  const windowsSource = useSourceLogs({
    sourceType: "windows",
    timeRange,
    liveLogs,
    limit: 2500,
    pollIntervalMs: WINDOWS_POLL_INTERVAL_MS,
  });
  const linuxSource = useSourceLogs({
    sourceType: "linux",
    timeRange,
    liveLogs,
    limit: 2500,
    pollIntervalMs: DASHBOARD_POLL_INTERVAL_MS,
  });
  const networkSource = useSourceLogs({
    sourceType: "network",
    timeRange,
    liveLogs,
    limit: 4000,
    pollIntervalMs: DASHBOARD_POLL_INTERVAL_MS,
  });
  const webSource = useSourceLogs({
    sourceType: "web",
    timeRange,
    liveLogs,
    limit: 3500,
    pollIntervalMs: DASHBOARD_POLL_INTERVAL_MS,
  });
  const applicationSource = useSourceLogs({
    sourceType: "application",
    timeRange,
    liveLogs,
    limit: 3500,
    pollIntervalMs: DASHBOARD_POLL_INTERVAL_MS,
  });
  const databaseSource = useSourceLogs({
    sourceType: "database",
    timeRange,
    liveLogs,
    limit: 3500,
    pollIntervalMs: DASHBOARD_POLL_INTERVAL_MS,
  });

  const refreshData = useCallback(async () => {
    const qs = timeRange === "all" ? "" : `?timeRange=${timeRange}`;
    try {
      const [alertsRes, logsRes, soarRes, summaryRes] = await Promise.all([
        API.get(`/api/alerts${qs}`).catch(() => ({ data: [] })),
        API.get(`/api/logs${qs}`).catch(() => ({ data: [] })),
        API.get("/api/soar").catch(() => ({ data: [] })),
        API.get(`/api/logs/summary${qs}`).catch(() => ({ data: null })),
      ]);

      const nextAlerts = (alertsRes.data || [])
        .map(normalizeAlert)
        .filter(Boolean);
      const nextLogs = (logsRes.data || [])
        .map(normalizeLog)
        .filter(Boolean);

      setAlerts(nextAlerts.slice(0, MAX_ALERTS));
      setLogs(nextLogs.slice(0, MAX_LOGS));
      setSoarLogs((soarRes.data || []).slice(0, MAX_SOAR));
      setLogSummary(summaryRes.data || null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  }, [timeRange]);

  refreshRef.current = refreshData;

  useEffect(() => {
    setLiveLogs([]);
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    const handleIncomingLog = (rawLog) => {
      const log = normalizeLog(rawLog);
      if (!log) return;

      setLiveLogs((prev) => prependUnique(prev, log, MAX_LIVE_LOGS));
      setLogs((prev) => prependUnique(prev, log, MAX_LOGS));
      setLogSummary((prev) => {
        if (!prev || !prev.bySource) return prev;
        const source = log.source || log.logType || "system";
        return {
          ...prev,
          total: (prev.total || 0) + 1,
          bySource: {
            ...prev.bySource,
            [source]: (prev.bySource[source] || 0) + 1,
          },
        };
      });
    };

    const handleIncomingAlert = (rawAlert) => {
      const alert = normalizeAlert(rawAlert);
      if (!alert) return;
      setAlerts((prev) => prependUnique(prev, alert, MAX_ALERTS));
    };

    const handleSoarAction = (event) => {
      if (!event) return;
      setSoarLogs((prev) => prependUnique(prev, event, MAX_SOAR));
    };

    socket.on("newLog", handleIncomingLog);
    socket.on("new_log", handleIncomingLog);
    socket.on("newAlert", handleIncomingAlert);
    socket.on("new_alert", handleIncomingAlert);
    socket.on("soarAction", handleSoarAction);
    socket.on("metricsUpdate", setMetrics);
    socket.on("reconnect", () => {
      if (refreshRef.current) {
        refreshRef.current();
      }
    });

    return () => {
      socket.off("newLog", handleIncomingLog);
      socket.off("new_log", handleIncomingLog);
      socket.off("newAlert", handleIncomingAlert);
      socket.off("new_alert", handleIncomingAlert);
      socket.off("soarAction", handleSoarAction);
      socket.off("metricsUpdate", setMetrics);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (refreshRef.current) {
        refreshRef.current();
      }
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const resolveAlert = useCallback(async (alertId) => {
    if (!alertId) return null;
    try {
      const res = await API.put(`/api/alerts/${alertId}`);
      const updated = normalizeAlert(res.data);
      if (updated) {
        setAlerts((prev) =>
          prev.map((entry) => (entry._id === updated._id ? { ...entry, ...updated } : entry)),
        );
      }
      return updated;
    } catch (err) {
      console.error("Resolve alert error:", err);
      return null;
    }
  }, []);

  const sharedProps = {
    alerts,
    logs,
    liveLogs,
    soarLogs,
    metrics,
    timeRange,
    logSummary,
    onResolveAlert: resolveAlert,
    onRefresh: refreshData,
  };

  const renderRoute = (Component, extraProps = {}) => (
    <AppLayout alerts={alerts}>
      <Component {...sharedProps} {...extraProps} />
    </AppLayout>
  );

  return (
    <Router>
      <Routes>
        <Route path="/" element={renderRoute(Overview)} />
        <Route path="/alerts" element={renderRoute(AlertsPage)} />
        <Route path="/logs" element={renderRoute(LogsPage)} />
        <Route
          path="/network"
          element={renderRoute(NetworkPage, {
            logs: networkSource.logs,
            totalCount: networkSource.total,
          })}
        />
        <Route path="/system" element={renderRoute(SystemMetrics)} />
        <Route
          path="/windows"
          element={renderRoute(WindowsDashboard, {
            logs: windowsSource.logs,
            totalCount: windowsSource.total,
          })}
        />
        <Route
          path="/application"
          element={renderRoute(ApplicationLogs, {
            logs: applicationSource.logs,
            totalCount: applicationSource.total,
          })}
        />
        <Route
          path="/web"
          element={renderRoute(WebDashboard, {
            logs: webSource.logs,
            totalCount: webSource.total,
          })}
        />
        <Route
          path="/linux"
          element={renderRoute(LinuxDashboard, {
            logs: linuxSource.logs,
            totalCount: linuxSource.total,
          })}
        />
        <Route
          path="/database"
          element={renderRoute(DatabaseDashboard, {
            logs: databaseSource.logs,
            totalCount: databaseSource.total,
          })}
        />
      </Routes>
    </Router>
  );
}
