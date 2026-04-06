import React, { useEffect, useState, useCallback, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import API from "./api";
import "./index.css";

// Pages
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

/* ===============================
   ✅ SOCKET (FIXED)
================================= */
// 🔥 IMPORTANT: Replace with your IP
const SOCKET_URL = "http://localhost:5000";

// ===== SIDEBAR NAV ITEMS =====
const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "SOC Dashboard", icon: "🛡️", exact: true },
      { path: "/alerts", label: "Alerts", icon: "🚨", badgeKey: "criticalAlerts", badgeColor: "red" },
    ]
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
    ]
  },
  {
    label: "Analysis",
    items: [
      { path: "/logs", label: "All Logs", icon: "📁" },
    ]
  }
];

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="topbar-time">
      {time.toLocaleString("en-US", { hour12: false })}
    </span>
  );
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

function AppLayout({ children, alerts, onRefresh, timeRange, setTimeRange }) {
  const location = useLocation();
  const criticalCount = alerts.filter(a => a.severity === "Critical").length;
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

        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            <nav className="sidebar-nav">
              {section.items.map(item => (
                <NavLink key={item.path} to={item.path} end={item.exact}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
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
  const [soarLogs, setSoarLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [timeRange, setTimeRange] = useState("all");

  const socketRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const qs = timeRange === "all" ? "" : `?timeRange=${timeRange}`;
      const [alertsRes, logsRes] = await Promise.all([
        API.get(`/api/alerts${qs}`).catch(() => ({ data: [] })),
        API.get(`/api/logs${qs}`).catch(() => ({ data: [] })),
      ]);

      setAlerts(alertsRes.data || []);
      setLogs(logsRes.data || []);
    } catch (e) {
      console.error("Fetch error:", e);
    }

    try {
      const soarRes = await API.get("/api/soar");
      setSoarLogs(soarRes.data || []);
    } catch {
      setSoarLogs([]);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAll();

    // ✅ CREATE SOCKET ONCE
    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("✅ Connected:", socket.id);
    });

    // ✅ FIXED EVENT NAMES
    socket.on("newLog", (log) => {
      setLogs(prev => [log, ...prev]);
    });

    socket.on("newAlert", (alert) => {
      setAlerts(prev => [alert, ...prev]);
    });

    socket.on("soarAction", (data) => {
      setSoarLogs(prev => [data, ...prev]);
    });

    socket.on("metricsUpdate", (data) => {
      setMetrics(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchAll]);

  const sharedProps = { alerts, logs, soarLogs, metrics };

  const renderRoute = (Component) => (
    <AppLayout alerts={alerts} onRefresh={fetchAll} timeRange={timeRange} setTimeRange={setTimeRange}>
      <Component {...sharedProps} />
    </AppLayout>
  );

  return (
    <Router>
      <Routes>
        <Route path="/" element={renderRoute(Overview)} />
        <Route path="/alerts" element={renderRoute(AlertsPage)} />
        <Route path="/logs" element={renderRoute(LogsPage)} />
        <Route path="/network" element={renderRoute(NetworkPage)} />
        <Route path="/system" element={renderRoute(SystemMetrics)} />
        <Route path="/windows" element={renderRoute(WindowsDashboard)} />
        <Route path="/application" element={renderRoute(ApplicationLogs)} />
        <Route path="/web" element={renderRoute(WebDashboard)} />
        <Route path="/linux" element={renderRoute(LinuxDashboard)} />
        <Route path="/database" element={renderRoute(DatabaseDashboard)} />
      </Routes>
    </Router>
  );
}