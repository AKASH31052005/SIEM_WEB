import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const WINDOW_OPTIONS = [
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 60, label: "60m" },
];

const ACTION_COLORS = { ALLOW: "#73bf69", BLOCK: "#f2495c" };
const PORT_RISK = new Set([22, 23, 445, 3389, 4444, 1337, 6667]);
const IOC_IPS = new Set(["185.220.101.1", "103.27.202.99", "45.9.148.114", "91.219.236.222"]);

function toTs(value) {
  const d = value ? new Date(value) : null;
  if (!d) return 0;
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function normalizeAction(value) {
  return String(value || "ALLOW").toUpperCase() === "BLOCK" ? "BLOCK" : "ALLOW";
}

function isPrivateIp(ip) {
  const raw = String(ip || "");
  if (!raw || raw === "unknown") return false;
  if (raw.startsWith("10.")) return true;
  if (raw.startsWith("192.168.")) return true;
  const parts = raw.split(".");
  if (parts.length !== 4) return false;
  const p0 = Number(parts[0]);
  const p1 = Number(parts[1]);
  if (!Number.isFinite(p0) || !Number.isFinite(p1)) return false;
  return p0 === 172 && p1 >= 16 && p1 <= 31;
}

function isSuspicious(log) {
  const severity = String(log.severity || "").toLowerCase();
  return (
    log.action === "BLOCK" ||
    severity.includes("high") ||
    severity.includes("critical") ||
    Boolean(log.suspicious) ||
    PORT_RISK.has(Number(log.destPort))
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "7px 11px", fontSize: 12 }}>
      {label ? <p style={{ color: "#9fa7b3", fontSize: 10, marginBottom: 3 }}>{label}</p> : null}
      {payload.map((entry, i) => (
        <p key={`${entry.name}-${i}`} style={{ color: entry.color || entry.fill || "#5794f2", fontWeight: 600 }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export default function NetworkPage({ logs = [], totalCount }) {
  const [search, setSearch] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(15);

  const networkLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs
      .filter((log) => {
        const type = String(log.logType || log.source || "").toLowerCase();
        return type === "network" || log.srcIP !== undefined || log.destIP !== undefined;
      })
      .map((log, index) => ({
        ...log,
        stableId:
          log._id ||
          `${log.srcIP || log.sourceIP || "?"}|${log.destIP || log.dst_ip || "?"}|${log.destPort || log.port || "?"}|${log.timestamp || log.createdAt || ""}|${index}`,
        timestamp: log.timestamp || log.createdAt || null,
        timestampMs: toTs(log.timestamp || log.createdAt),
        srcIP: log.srcIP || log.sourceIP || log.source_ip || "unknown",
        destIP: log.destIP || log.dst_ip || "unknown",
        srcPort: Number(log.srcPort || 0) || null,
        destPort: Number(log.destPort || log.port || 0) || null,
        protocol: String(log.protocol || "UNKNOWN").toUpperCase(),
        action: normalizeAction(log.action),
        direction: String(log.direction || "OUTBOUND").toUpperCase(),
        bytesTransferred: Number(log.bytesTransferred || 0) || 0,
        tlsVersion: log.tlsVersion || log.tls || null,
        ja3: log.ja3 || null,
        dnsQuery: log.dnsQuery || log.domain || null,
        state: String(log.state || log.connectionState || "UNKNOWN").toUpperCase(),
      }))
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [logs]);

  const realtimeLogs = useMemo(() => {
    const now = Date.now();
    const cutoff = now - windowMinutes * 60 * 1000;
    return networkLogs.filter((log) => log.timestampMs >= cutoff);
  }, [networkLogs, windowMinutes]);

  const filteredRealtimeLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return realtimeLogs;
    return realtimeLogs.filter((log) => {
      const target = `${log.srcIP} ${log.destIP} ${log.protocol} ${log.action} ${log.destPort || ""} ${log.direction}`.toLowerCase();
      return target.includes(q);
    });
  }, [realtimeLogs, search]);

  const minuteTrend = useMemo(() => {
    const now = Date.now();
    const bucketMs = 60000;
    const points = [];
    for (let i = windowMinutes - 1; i >= 0; i -= 1) {
      const start = now - i * bucketMs;
      points.push({
        key: Math.floor(start / bucketMs),
        time: new Date(start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        events: 0,
        suspicious: 0,
        blocked: 0,
        inbound: 0,
        outbound: 0,
        bytes: 0,
      });
    }
    const map = new Map(points.map((p, i) => [p.key, i]));
    realtimeLogs.forEach((log) => {
      const key = Math.floor(log.timestampMs / bucketMs);
      const idx = map.get(key);
      if (idx === undefined) return;
      const row = points[idx];
      row.events += 1;
      row.bytes += log.bytesTransferred;
      if (isSuspicious(log)) row.suspicious += 1;
      if (log.action === "BLOCK") row.blocked += 1;
      if (log.direction === "INBOUND") row.inbound += 1;
      else row.outbound += 1;
    });
    return points;
  }, [realtimeLogs, windowMinutes]);

  const metrics = useMemo(() => {
    const blocked = realtimeLogs.filter((l) => l.action === "BLOCK").length;
    const suspicious = realtimeLogs.filter(isSuspicious).length;
    const inbound = realtimeLogs.filter((l) => l.direction === "INBOUND").length;
    const outbound = realtimeLogs.length - inbound;
    const eastWest = realtimeLogs.filter((l) => isPrivateIp(l.srcIP) && isPrivateIp(l.destIP)).length;
    const bytes = realtimeLogs.reduce((sum, l) => sum + (l.bytesTransferred || 0), 0);
    return {
      total: realtimeLogs.length,
      blocked,
      allowed: realtimeLogs.length - blocked,
      suspicious,
      inbound,
      outbound,
      eastWest,
      uniqueSources: new Set(realtimeLogs.map((l) => l.srcIP).filter(Boolean)).size,
      uniqueDests: new Set(realtimeLogs.map((l) => l.destIP).filter(Boolean)).size,
      bytes,
      suspiciousRate: realtimeLogs.length ? Math.round((suspicious / realtimeLogs.length) * 100) : 0,
    };
  }, [realtimeLogs]);

  const actionPie = useMemo(
    () => [
      { name: "ALLOW", value: metrics.allowed, color: ACTION_COLORS.ALLOW },
      { name: "BLOCK", value: metrics.blocked, color: ACTION_COLORS.BLOCK },
    ],
    [metrics.allowed, metrics.blocked],
  );

  const topSources = useMemo(() => {
    const counts = {};
    realtimeLogs.forEach((l) => {
      counts[l.srcIP] = (counts[l.srcIP] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([ip, count]) => ({ ip, count }));
  }, [realtimeLogs]);

  const topDestinations = useMemo(() => {
    const counts = {};
    realtimeLogs.forEach((l) => {
      counts[l.destIP] = (counts[l.destIP] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([ip, count]) => ({ ip, count }));
  }, [realtimeLogs]);

  const protocolBars = useMemo(() => {
    const counts = {};
    realtimeLogs.forEach((l) => {
      counts[l.protocol] = (counts[l.protocol] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [realtimeLogs]);

  const topPorts = useMemo(() => {
    const counts = {};
    realtimeLogs.forEach((l) => {
      if (!l.destPort) return;
      counts[String(l.destPort)] = (counts[String(l.destPort)] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([port, count]) => ({ port, count }));
  }, [realtimeLogs]);

  const stateBars = useMemo(() => {
    const counts = {};
    realtimeLogs.forEach((l) => {
      counts[l.state] = (counts[l.state] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([state, count]) => ({ state, count }));
  }, [realtimeLogs]);

  const topConversations = useMemo(() => {
    const counts = {};
    realtimeLogs.forEach((l) => {
      const key = `${l.srcIP} -> ${l.destIP}:${l.destPort || "-"}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([flow, count]) => ({ flow, count }));
  }, [realtimeLogs]);

  const portScanMatrix = useMemo(() => {
    const srcSet = new Set();
    const portSet = new Set();
    const freq = {};
    realtimeLogs.forEach((l) => {
      if (!l.destPort) return;
      srcSet.add(l.srcIP);
      portSet.add(String(l.destPort));
      const key = `${l.srcIP}|${l.destPort}`;
      freq[key] = (freq[key] || 0) + 1;
    });
    const topSrc = Array.from(srcSet)
      .sort((a, b) => {
        const ca = Object.keys(freq).filter((k) => k.startsWith(`${a}|`)).length;
        const cb = Object.keys(freq).filter((k) => k.startsWith(`${b}|`)).length;
        return cb - ca;
      })
      .slice(0, 8);
    const topPort = Array.from(portSet)
      .sort((a, b) => {
        const ca = realtimeLogs.filter((l) => String(l.destPort) === a).length;
        const cb = realtimeLogs.filter((l) => String(l.destPort) === b).length;
        return cb - ca;
      })
      .slice(0, 8);
    const rows = [];
    topSrc.forEach((src, y) => {
      topPort.forEach((port, x) => {
        const v = freq[`${src}|${port}`] || 0;
        if (v > 0) rows.push({ x, y, value: v, src, port });
      });
    });
    return { topSrc, topPort, rows };
  }, [realtimeLogs]);

  const threatIntel = useMemo(() => {
    const hits = realtimeLogs.filter((l) => IOC_IPS.has(l.srcIP) || IOC_IPS.has(l.destIP) || PORT_RISK.has(Number(l.destPort)));
    const iocIpHits = hits.filter((l) => IOC_IPS.has(l.srcIP) || IOC_IPS.has(l.destIP)).length;
    const riskyPortHits = hits.filter((l) => PORT_RISK.has(Number(l.destPort))).length;
    return { totalHits: hits.length, iocIpHits, riskyPortHits, recent: hits.slice(0, 6) };
  }, [realtimeLogs]);

  const anomaly = useMemo(() => {
    const series = minuteTrend.map((p) => p.events);
    if (!series.length) return { score: 0, peak: 0, avg: 0 };
    const avg = series.reduce((a, b) => a + b, 0) / series.length;
    const variance = series.reduce((sum, v) => sum + (v - avg) ** 2, 0) / series.length;
    const std = Math.sqrt(variance);
    const latest = series[series.length - 1] || 0;
    const z = std > 0 ? (latest - avg) / std : 0;
    const score = Math.max(0, Math.min(100, Math.round((Math.abs(z) / 3) * 100)));
    return { score, peak: Math.max(...series), avg: Math.round(avg * 10) / 10 };
  }, [minuteTrend]);

  const dnsMetrics = useMemo(() => {
    const dnsLogs = realtimeLogs.filter((l) => l.destPort === 53 || l.protocol === "DNS");
    const nxdomain = dnsLogs.filter((l) => String(l.message || "").toLowerCase().includes("nxdomain")).length;
    const tldCounts = {};
    dnsLogs.forEach((l) => {
      const query = String(l.dnsQuery || l.destIP || "");
      const parts = query.split(".");
      const tld = parts.length > 1 ? parts[parts.length - 1] : "unknown";
      tldCounts[tld] = (tldCounts[tld] || 0) + 1;
    });
    const topTlds = Object.entries(tldCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { dnsCount: dnsLogs.length, nxdomain, topTlds };
  }, [realtimeLogs]);

  const tlsMetrics = useMemo(() => {
    const tlsLogs = realtimeLogs.filter((l) => l.destPort === 443 || l.protocol === "TLS" || l.protocol === "HTTPS");
    const vers = {};
    const ja3Counts = {};
    tlsLogs.forEach((l) => {
      const version = String(l.tlsVersion || "unknown");
      vers[version] = (vers[version] || 0) + 1;
      if (l.ja3) ja3Counts[l.ja3] = (ja3Counts[l.ja3] || 0) + 1;
    });
    const topVersions = Object.entries(vers).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const rareJa3 = Object.entries(ja3Counts).filter(([, c]) => c <= 2).slice(0, 4);
    return { tlsCount: tlsLogs.length, topVersions, rareJa3Count: rareJa3.length };
  }, [realtimeLogs]);

  const throughput = useMemo(() => {
    const now = Date.now();
    const last60s = realtimeLogs.filter((l) => l.timestampMs >= now - 60000);
    const inboundBytes = last60s.filter((l) => l.direction === "INBOUND").reduce((s, l) => s + l.bytesTransferred, 0);
    const outboundBytes = last60s.filter((l) => l.direction !== "INBOUND").reduce((s, l) => s + l.bytesTransferred, 0);
    const topByBytes = [...realtimeLogs]
      .sort((a, b) => (b.bytesTransferred || 0) - (a.bytesTransferred || 0))
      .slice(0, 5)
      .map((l) => ({ flow: `${l.srcIP} -> ${l.destIP}:${l.destPort || "-"}`, bytes: l.bytesTransferred || 0 }));
    return { inboundBytes, outboundBytes, topByBytes };
  }, [realtimeLogs]);

  const blockEffect = useMemo(() => {
    const offenders = {};
    realtimeLogs.forEach((l) => {
      offenders[l.srcIP] = offenders[l.srcIP] || { total: 0, blocked: 0 };
      offenders[l.srcIP].total += 1;
      if (l.action === "BLOCK") offenders[l.srcIP].blocked += 1;
    });
    const repeatOffenders = Object.values(offenders).filter((v) => v.total >= 3).length;
    const blockedRepeat = Object.values(offenders).filter((v) => v.total >= 3 && v.blocked > 0).length;
    const suppressRate = repeatOffenders ? Math.round((blockedRepeat / repeatOffenders) * 100) : 0;
    return { repeatOffenders, blockedRepeat, suppressRate };
  }, [realtimeLogs]);

  const newExternal = useMemo(() => {
    const current = new Set(realtimeLogs.map((l) => l.destIP).filter((ip) => ip && !isPrivateIp(ip)));
    const prevCutoff = Date.now() - windowMinutes * 2 * 60 * 1000;
    const prev = new Set(
      networkLogs
        .filter((l) => l.timestampMs >= prevCutoff && l.timestampMs < Date.now() - windowMinutes * 60 * 1000)
        .map((l) => l.destIP)
        .filter((ip) => ip && !isPrivateIp(ip)),
    );
    const newcomers = Array.from(current).filter((ip) => !prev.has(ip)).slice(0, 10);
    return { count: newcomers.length, newcomers };
  }, [networkLogs, realtimeLogs, windowMinutes]);

  const serviceExposure = useMemo(() => {
    const counts = {};
    realtimeLogs.forEach((l) => {
      if (!l.destPort) return;
      const internalTarget = isPrivateIp(l.destIP);
      if (!internalTarget) return;
      const key = String(l.destPort);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([port, hits]) => ({ port, hits }));
  }, [realtimeLogs]);

  const geoLike = useMemo(() => {
    const buckets = { internal: 0, external: 0, unknown: 0 };
    realtimeLogs.forEach((l) => {
      if (!l.srcIP || l.srcIP === "unknown") buckets.unknown += 1;
      else if (isPrivateIp(l.srcIP)) buckets.internal += 1;
      else buckets.external += 1;
    });
    return [
      { name: "Internal", value: buckets.internal, color: "#5794f2" },
      { name: "External", value: buckets.external, color: "#f2c94c" },
      { name: "Unknown", value: buckets.unknown, color: "#8e99a8" },
    ];
  }, [realtimeLogs]);

  const asnLike = useMemo(() => {
    const groups = {};
    realtimeLogs.forEach((l) => {
      const key = isPrivateIp(l.destIP) ? "Private ASN" : "Public ASN";
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [realtimeLogs]);

  const latestEventText = realtimeLogs[0]?.timestamp
    ? new Date(realtimeLogs[0].timestamp).toLocaleString()
    : "No real-time network data";

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="badge badge-info" style={{ fontSize: 10 }}>NETWORK REALTIME</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {metrics.total.toLocaleString()} events in last {windowMinutes}m ({(totalCount ?? networkLogs.length).toLocaleString()} indexed)
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select className="filter-select" value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))} style={{ minWidth: 78 }}>
            {WINDOW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Last event: {latestEventText}</span>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(8, 1fr)" }}>
        {[
          { label: "Events", value: metrics.total, className: "blue" },
          { label: "Suspicious", value: metrics.suspicious, className: "red" },
          { label: "Blocked", value: metrics.blocked, className: "orange" },
          { label: "Inbound", value: metrics.inbound, className: "yellow" },
          { label: "Outbound", value: metrics.outbound, className: "green" },
          { label: "East-West", value: metrics.eastWest, className: "blue" },
          { label: "Threat Hits", value: threatIntel.totalHits, className: "red" },
          { label: "Anomaly", value: `${anomaly.score}%`, className: "orange" },
        ].map((card) => (
          <div key={card.label} className={`stat-panel ${card.className}`}>
            <div className="stat-label">{card.label}</div>
            <div className={`stat-value ${card.className}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="panel-grid grid-70-30" style={{ marginBottom: 8 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">📈</span>Traffic and Suspicious Trend</div></div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={minuteTrend}>
                <defs>
                  <linearGradient id="gEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5794f2" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5794f2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f2495c" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f2495c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="events" name="Events" stroke="#5794f2" fill="url(#gEvents)" dot={false} />
                <Area type="monotone" dataKey="suspicious" name="Suspicious" stroke="#f2495c" fill="url(#gSus)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🛡️</span>Action Distribution</div></div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie data={actionPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={84}>
                  {actionPie.map((entry, i) => <Cell key={`${entry.name}-${i}`} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>Suspicious rate: {metrics.suspiciousRate}%</div>
          </div>
        </div>
      </div>

      <div className="panel-grid grid-50-50" style={{ marginBottom: 8 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">↕️</span>Inbound vs Outbound Trend</div></div>
          <div className="panel-body" style={{ padding: "12px 8px 8px 0" }}>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={minuteTrend}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="inbound" name="Inbound" stroke="#f2c94c" fill="rgba(242,201,76,0.18)" dot={false} />
                <Area type="monotone" dataKey="outbound" name="Outbound" stroke="#73bf69" fill="rgba(115,191,105,0.18)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">📶</span>Bandwidth Throughput (Last Minute)</div></div>
          <div className="panel-body">
            <div className="metric-row"><span className="metric-label">Inbound B/s</span><span className="metric-val">{Math.round(throughput.inboundBytes / 60).toLocaleString()}</span></div>
            <div className="metric-row"><span className="metric-label">Outbound B/s</span><span className="metric-val">{Math.round(throughput.outboundBytes / 60).toLocaleString()}</span></div>
            <div className="metric-row"><span className="metric-label">Window Bytes</span><span className="metric-val">{metrics.bytes.toLocaleString()}</span></div>
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>Top flows by bytes:</div>
            {throughput.topByBytes.length ? throughput.topByBytes.map((entry) => (
              <div key={entry.flow} className="metric-row">
                <span className="metric-label" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.flow}</span>
                <span className="metric-val">{entry.bytes.toLocaleString()}</span>
              </div>
            )) : <div className="empty-state"><p>No throughput data</p></div>}
          </div>
        </div>
      </div>

      <div className="panel-grid grid-3" style={{ marginBottom: 8 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🎯</span>Top Source IPs</div></div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 220 }}>
            {topSources.length ? topSources.map((entry, i) => (
              <div key={entry.ip} className="metric-row" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ minWidth: 16, fontSize: 10 }}>{i + 1}</span><span className="ip-badge">{entry.ip}</span><span className="metric-val">{entry.count}</span>
              </div>
            )) : <div className="empty-state"><p>No source data</p></div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🧭</span>Top Destination IPs</div></div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 220 }}>
            {topDestinations.length ? topDestinations.map((entry, i) => (
              <div key={entry.ip} className="metric-row" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ minWidth: 16, fontSize: 10 }}>{i + 1}</span><span className="ip-badge">{entry.ip}</span><span className="metric-val">{entry.count}</span>
              </div>
            )) : <div className="empty-state"><p>No destination data</p></div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🚪</span>Service Exposure (Internal Ports)</div></div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 220 }}>
            {serviceExposure.length ? serviceExposure.map((entry, i) => (
              <div key={entry.port} className="metric-row" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ minWidth: 16, fontSize: 10 }}>{i + 1}</span><span className="metric-label">Port {entry.port}</span><span className="metric-val">{entry.hits}</span>
              </div>
            )) : <div className="empty-state"><p>No internal exposure data</p></div>}
          </div>
        </div>
      </div>

      <div className="panel-grid grid-3" style={{ marginBottom: 8 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🔌</span>Protocol Distribution</div></div>
          <div className="panel-body" style={{ padding: "10px 6px 6px 0" }}>
            {protocolBars.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={protocolBars} layout="vertical">
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#9fa7b3", fontSize: 10 }} width={68} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#5794f2" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No protocol data</p></div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">📡</span>Connection States</div></div>
          <div className="panel-body" style={{ padding: "10px 6px 6px 0" }}>
            {stateBars.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stateBars}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="state" tick={{ fill: "#9fa7b3", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#f2c94c" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No connection state data</p></div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🎛️</span>Top Dest Ports</div></div>
          <div className="panel-body" style={{ padding: "10px 6px 6px 0" }}>
            {topPorts.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topPorts}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="port" tick={{ fill: "#9fa7b3", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#ff9830" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No port data</p></div>}
          </div>
        </div>
      </div>

      <div className="panel-grid grid-50-50" style={{ marginBottom: 8 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🔎</span>Top Conversations</div></div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 220 }}>
            {topConversations.length ? topConversations.map((entry) => (
              <div key={entry.flow} className="metric-row" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <span className="metric-label" style={{ maxWidth: 440, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.flow}</span>
                <span className="metric-val">{entry.count}</span>
              </div>
            )) : <div className="empty-state"><p>No conversation data</p></div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🧱</span>Port Scan Heatmap</div></div>
          <div className="panel-body">
            {portScanMatrix.rows.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" dataKey="x" tickFormatter={(v) => portScanMatrix.topPort[v] || ""} tick={{ fill: "#9fa7b3", fontSize: 9 }} />
                  <YAxis type="number" dataKey="y" tickFormatter={(v) => (portScanMatrix.topSrc[v] || "").slice(0, 12)} tick={{ fill: "#9fa7b3", fontSize: 9 }} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
                  <Scatter data={portScanMatrix.rows} fill="#f2495c" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No scan-like matrix data</p></div>}
          </div>
        </div>
      </div>

      <div className="panel-grid grid-3" style={{ marginBottom: 8 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🛰️</span>Threat Intel Matches</div></div>
          <div className="panel-body">
            <div className="metric-row"><span className="metric-label">Total Hits</span><span className="metric-val">{threatIntel.totalHits}</span></div>
            <div className="metric-row"><span className="metric-label">IOC IP Hits</span><span className="metric-val">{threatIntel.iocIpHits}</span></div>
            <div className="metric-row"><span className="metric-label">Risky Port Hits</span><span className="metric-val">{threatIntel.riskyPortHits}</span></div>
            {threatIntel.recent.slice(0, 4).map((hit) => (
              <div key={hit.stableId} className="metric-row">
                <span className="metric-label" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.srcIP} -> {hit.destIP}</span>
                <span className="badge badge-critical" style={{ fontSize: 10 }}>{hit.destPort || "-"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🧠</span>Anomaly Score</div></div>
          <div className="panel-body">
            <div className="metric-row"><span className="metric-label">Current Score</span><span className="metric-val">{anomaly.score}%</span></div>
            <div className="metric-row"><span className="metric-label">Minute Avg</span><span className="metric-val">{anomaly.avg}</span></div>
            <div className="metric-row"><span className="metric-label">Minute Peak</span><span className="metric-val">{anomaly.peak}</span></div>
            <div style={{ marginTop: 10 }} className="progress-bar-wrap">
              <div className="progress-bar orange" style={{ width: `${anomaly.score}%` }} />
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🚫</span>Block Effectiveness</div></div>
          <div className="panel-body">
            <div className="metric-row"><span className="metric-label">Repeat Offenders</span><span className="metric-val">{blockEffect.repeatOffenders}</span></div>
            <div className="metric-row"><span className="metric-label">Blocked Repeaters</span><span className="metric-val">{blockEffect.blockedRepeat}</span></div>
            <div className="metric-row"><span className="metric-label">Suppression Rate</span><span className="metric-val">{blockEffect.suppressRate}%</span></div>
          </div>
        </div>
      </div>

      <div className="panel-grid grid-3" style={{ marginBottom: 8 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🌍</span>Geo-Zone Mix</div></div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie data={geoLike} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={56} outerRadius={80}>
                  {geoLike.map((entry, i) => <Cell key={`${entry.name}-${i}`} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🏢</span>ASN Group Mix</div></div>
          <div className="panel-body" style={{ padding: "10px 6px 6px 0" }}>
            {asnLike.length ? (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={asnLike}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#9fa7b3", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#5a6478", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#5794f2" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>No ASN data</p></div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🆕</span>New External Destinations</div></div>
          <div className="panel-body no-pad scroll" style={{ maxHeight: 220 }}>
            <div className="metric-row" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
              <span className="metric-label">New External IPs</span><span className="metric-val">{newExternal.count}</span>
            </div>
            {newExternal.newcomers.length ? newExternal.newcomers.map((ip) => (
              <div key={ip} className="metric-row" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <span className="ip-badge">{ip}</span>
              </div>
            )) : <div className="empty-state"><p>No new external destinations</p></div>}
          </div>
        </div>
      </div>

      <div className="panel-grid grid-50-50" style={{ marginBottom: 8 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🌐</span>DNS Activity</div></div>
          <div className="panel-body">
            <div className="metric-row"><span className="metric-label">DNS Events</span><span className="metric-val">{dnsMetrics.dnsCount}</span></div>
            <div className="metric-row"><span className="metric-label">NXDOMAIN</span><span className="metric-val">{dnsMetrics.nxdomain}</span></div>
            {dnsMetrics.topTlds.length ? dnsMetrics.topTlds.map(([tld, count]) => (
              <div key={tld} className="metric-row"><span className="metric-label">.{tld}</span><span className="metric-val">{count}</span></div>
            )) : <div className="empty-state"><p>No DNS breakdown</p></div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-title-icon">🔐</span>TLS / JA3 Activity</div></div>
          <div className="panel-body">
            <div className="metric-row"><span className="metric-label">TLS Events</span><span className="metric-val">{tlsMetrics.tlsCount}</span></div>
            <div className="metric-row"><span className="metric-label">Rare JA3</span><span className="metric-val">{tlsMetrics.rareJa3Count}</span></div>
            {tlsMetrics.topVersions.length ? tlsMetrics.topVersions.map(([version, count]) => (
              <div key={version} className="metric-row"><span className="metric-label">{version}</span><span className="metric-val">{count}</span></div>
            )) : <div className="empty-state"><p>No TLS version data</p></div>}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title"><span className="panel-title-icon">📋</span>Live Network Feed</div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filteredRealtimeLogs.length} matched</span>
        </div>
        <div className="toolbar" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <span>🔍</span>
            <input placeholder="Search src/dst, protocol, action, port, direction..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="panel-body no-pad scroll" style={{ maxHeight: 320 }}>
          {filteredRealtimeLogs.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 12 }}>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Port</th><th>Dir</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRealtimeLogs.slice(0, 100).map((log) => (
                  <tr key={log.stableId}>
                    <td style={{ paddingLeft: 12, fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-muted)" }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "--"}
                    </td>
                    <td><span className="ip-badge">{log.srcIP}</span></td>
                    <td><span className="ip-badge">{log.destIP}</span></td>
                    <td style={{ fontSize: 11 }}>{log.protocol}</td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{log.destPort || "--"}</td>
                    <td style={{ fontSize: 11 }}>{log.direction}</td>
                    <td><span className={`badge ${log.action === "BLOCK" ? "badge-critical" : "badge-success"}`}>{log.action}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state"><div className="empty-icon">🌐</div><p>No real-time events in selected window</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
