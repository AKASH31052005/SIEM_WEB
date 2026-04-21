const express = require("express");

const router = express.Router();
const Log = require("../models/Log");
const Alert = require("../models/Alert");
const WindowsLog = require("../models/WindowsLog");
const LinuxLog = require("../models/LinuxLog");
const WebLog = require("../models/WebLog");
const NetworkLog = require("../models/NetworkLog");
const ApplicationLog = require("../models/ApplicationLog");
const DatabaseLog = require("../models/DatabaseLog");
const { normalizeAndStore } = require("../services/normalizationService");

const SOURCE_MODELS = {
  system: Log,
  windows: WindowsLog,
  linux: LinuxLog,
  web: WebLog,
  network: NetworkLog,
  application: ApplicationLog,
  database: DatabaseLog,
};

const SOURCE_TIME_FIELDS = {
  system: "timestamp",
  windows: "TimeCreated",
  linux: "Timestamp",
  web: "createdAt",
  network: "timestamp",
  application: "timestamp",
  database: "timestamp",
};

const SOURCE_KEYS = Object.keys(SOURCE_MODELS);
const DEFAULT_LIMIT = 1200;
const MAX_LIMIT = 5000;

function parseTimeRange(timeRange = "all") {
  if (timeRange === "all") return null;
  const now = Date.now();
  if (timeRange === "15m") return new Date(now - 15 * 60 * 1000);
  if (timeRange === "1h") return new Date(now - 60 * 60 * 1000);
  if (timeRange === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (timeRange === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  return null;
}

function buildDateFilter(field, since) {
  if (!since) return {};
  return {
    $or: [{ [field]: { $gte: since } }, { createdAt: { $gte: since } }],
  };
}

function normalizeSeverity(value, fallback = "Info") {
  const v = String(value || "").toLowerCase();
  if (!v) return fallback;
  if (v.includes("critical")) return "Critical";
  if (v.includes("high") || v.includes("error")) return "High";
  if (v.includes("warn") || v.includes("medium")) return "Medium";
  if (v.includes("low") || v.includes("info")) return "Low";
  return fallback;
}

function toDate(value) {
  const d = value ? new Date(value) : new Date(0);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function mapSystemLog(log) {
  return {
    ...log,
    source: "system",
    logType: log.logType || "system",
    timestamp: log.timestamp || log.createdAt,
    severity: normalizeSeverity(log.severity, "Info"),
    message: log.message || "",
  };
}

function mapWindowsLog(log) {
  const eventId = Number(log.EventID ?? log.eventId);
  const level = log.Level || log.level || "Information";
  let severity = normalizeSeverity(level, "Low");

  if ([4625, 4740, 1102].includes(eventId)) severity = "Critical";
  else if ([4672, 4720, 4726].includes(eventId)) severity = "High";

  return {
    ...log,
    source: "windows",
    logType: "windows",
    timestamp: log.TimeCreated || log.timestamp || log.createdAt,
    eventId: Number.isFinite(eventId) ? eventId : null,
    EventID: Number.isFinite(eventId) ? eventId : log.EventID,
    level,
    Level: level,
    severity,
    machineName: log.MachineName || log.machineName || "unknown",
    MachineName: log.MachineName || log.machineName || "unknown",
    username: log.Username || log.username || "unknown",
    Username: log.Username || log.username || "unknown",
    sourceIP: log.SourceIP || log.sourceIP || "unknown",
    SourceIP: log.SourceIP || log.sourceIP || "unknown",
    message: log.Message || log.message || "",
    Message: log.Message || log.message || "",
  };
}

function mapLinuxLog(log) {
  const host = log.Host || log.host || log.hostname || "unknown";
  const process = log.Process || log.process || log.app_name || "unknown";
  const facility = log.facility || process.split("[")[0] || "system";
  const message = log.Message || log.message || "";

  return {
    ...log,
    source: "linux",
    logType: "linux",
    timestamp: log.Timestamp || log.timestamp || log.createdAt,
    hostname: host,
    host,
    Host: host,
    process,
    Process: process,
    facility,
    severity: normalizeSeverity(log.severity || log.Status, "Low"),
    message,
    Message: message,
    ip: log.IP || log.ip || "unknown",
    IP: log.IP || log.ip || "unknown",
  };
}

function mapWebLog(log) {
  const method = String(log.Method || log.method || "UNKNOWN").toUpperCase();
  const status = Number.parseInt(log.StatusCode || log.statusCode || log.status, 10);
  const safeStatus = Number.isNaN(status) ? 0 : status;
  return {
    ...log,
    source: "web",
    logType: "web",
    timestamp: log.Timestamp || log.timestamp || log.createdAt,
    method,
    Method: method,
    url: log.URL || log.url || log.path || log.endpoint || "/",
    URL: log.URL || log.url || log.path || log.endpoint || "/",
    status: safeStatus,
    StatusCode: safeStatus,
    ip: log.IP || log.ip || "unknown",
    IP: log.IP || log.ip || "unknown",
    userAgent: log.UserAgent || log.userAgent || log.user_agent || "unknown",
    severity: safeStatus >= 500 ? "High" : safeStatus >= 400 ? "Medium" : "Low",
    message: log.message || `${method} ${log.URL || log.url || "/"}`,
  };
}

function mapNetworkLog(log) {
  const action = String(log.action || "ALLOW").toUpperCase();
  return {
    ...log,
    source: "network",
    logType: "network",
    timestamp: log.timestamp || log.Timestamp || log.createdAt,
    srcIP: log.srcIP || log.sourceIP || log.source_ip || "unknown",
    sourceIP: log.srcIP || log.sourceIP || log.source_ip || "unknown",
    destIP: log.destIP || log.dst_ip || "unknown",
    dst_ip: log.destIP || log.dst_ip || "unknown",
    destPort: log.destPort || log.port || null,
    action,
    severity: action === "BLOCK" ? "High" : "Low",
    suspicious: action === "BLOCK",
  };
}

function mapAppLevel(severityValue) {
  const value = String(severityValue || "").toLowerCase();
  if (value === "critical") return "Critical";
  if (value === "high") return "Error";
  if (value === "medium") return "Warning";
  return "Info";
}

function mapApplicationLog(log) {
  const level = mapAppLevel(log.severity || log.level);
  return {
    ...log,
    source: "application",
    logType: "application",
    timestamp: log.timestamp || log.createdAt,
    level,
    severity: level,
    service: log.service || "application",
    sourceService: log.event_category || "application",
    eventId: log.event_action || log.eventType || log.status_code || "app_event",
    method: log.method || null,
    endpoint: log.endpoint || null,
    status_code: log.status_code || null,
    ip: log.ip_address || log.ip || null,
    message: log.message || "Application event",
  };
}

function mapDatabaseLog(log) {
  const operation =
    log.operationType ||
    log.operation ||
    log.action ||
    log.method ||
    log.eventType ||
    "unknown";
  const status = String(log.status || "").toLowerCase();
  const failed =
    status === "failed" ||
    status === "error" ||
    normalizeSeverity(log.severity, "Low") === "High";

  return {
    ...log,
    source: "database",
    logType: "database",
    timestamp: log.timestamp || log.createdAt,
    operation,
    operationType: operation,
    method: operation,
    database: log.database || log.db || "unknown",
    collection: log.collection || log.collectionName || "unknown",
    user: log.user || log.username || "unknown",
    status: failed ? "failed" : "success",
    severity: failed ? "Critical" : "Low",
    event_category: "database",
    message:
      log.message ||
      `Database operation: ${operation} on ${log.collection || log.collectionName || "unknown"}`,
  };
}

const SOURCE_MAPPERS = {
  system: mapSystemLog,
  windows: mapWindowsLog,
  linux: mapLinuxLog,
  web: mapWebLog,
  network: mapNetworkLog,
  application: mapApplicationLog,
  database: mapDatabaseLog,
};

function emitRealtimeLog(io, payload) {
  if (!io) return;
  io.emit("newLog", payload);
  io.emit("new_log", payload);
}

function emitRealtimeAlert(io, payload) {
  if (!io) return;
  io.emit("newAlert", payload);
  io.emit("new_alert", payload);
}

async function fetchSourceLogs(sourceType, since, limit, includeTotal = true) {
  const Model = SOURCE_MODELS[sourceType];
  const timeField = SOURCE_TIME_FIELDS[sourceType];
  const mapper = SOURCE_MAPPERS[sourceType];
  const filter = buildDateFilter(timeField, since);

  const sortField = sourceType === "web" ? "createdAt" : timeField;
  const docQuery = Model.find(filter).sort({ [sortField]: -1, createdAt: -1 }).limit(limit).lean();
  const [docs, total] = includeTotal
    ? await Promise.all([docQuery, Model.countDocuments(filter)])
    : [await docQuery, null];

  const logs = docs
    .map((doc) => mapper(doc))
    .sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime());

  return { logs, total };
}

router.post("/", async (req, res) => {
  try {
    const rawLog = new Log(req.body);
    await rawLog.save();

    try {
      await normalizeAndStore(rawLog);
    } catch (normError) {
      console.error("Normalization error:", normError.message);
    }

    if (rawLog.eventId === 4625) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const failedAttempts = await Log.countDocuments({
        systemName: rawLog.systemName,
        eventId: 4625,
        timestamp: { $gte: fiveMinutesAgo },
      });

      if (failedAttempts >= 5) {
        const alert = new Alert({
          type: "Brute Force Attack",
          message: "Multiple failed login attempts detected",
          severity: "High",
          systemName: rawLog.systemName,
        });
        await alert.save();
        emitRealtimeAlert(req.app.get("io"), alert);
      }
    }

    emitRealtimeLog(req.app.get("io"), mapSystemLog(rawLog.toObject()));
    res.status(201).json(rawLog);
  } catch (error) {
    console.error("Log save error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post("/logs", async (req, res) => {
  try {
    const rawLog = new Log(req.body);
    await rawLog.save();

    try {
      await normalizeAndStore(rawLog);
    } catch (normError) {
      console.error("Normalization error:", normError.message);
    }

    emitRealtimeLog(req.app.get("io"), mapSystemLog(rawLog.toObject()));
    res.status(200).json({ message: "Log received" });
  } catch (error) {
    console.error("Agent log error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "all";
    const since = parseTimeRange(timeRange);

    const counts = await Promise.all(
      SOURCE_KEYS.map((source) => {
        const filter = buildDateFilter(SOURCE_TIME_FIELDS[source], since);
        return SOURCE_MODELS[source].countDocuments(filter);
      }),
    );

    const bySource = SOURCE_KEYS.reduce((acc, source, idx) => {
      acc[source] = counts[idx];
      return acc;
    }, {});

    const total = Object.values(bySource).reduce((sum, value) => sum + value, 0);

    res.json({
      timeRange,
      since: since ? since.toISOString() : null,
      total,
      bySource,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Summary fetch error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/source/:sourceType", async (req, res) => {
  try {
    const sourceType = String(req.params.sourceType || "").toLowerCase();
    if (!SOURCE_MODELS[sourceType]) {
      return res.status(400).json({
        message: `Invalid source type. Use one of: ${SOURCE_KEYS.join(", ")}`,
      });
    }

    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const since = parseTimeRange(req.query.timeRange || "all");
    const result = await fetchSourceLogs(sourceType, since, limit, true);

    res.json({
      source: sourceType,
      total: result.total,
      count: result.logs.length,
      logs: result.logs,
    });
  } catch (error) {
    console.error("Source log fetch error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 50), 15000)
      : 4000;
    const perSourceLimit = Math.min(
      MAX_LIMIT,
      Math.max(200, Math.ceil(limit / SOURCE_KEYS.length) * 2),
    );
    const since = parseTimeRange(req.query.timeRange || "all");

    const sourceResults = await Promise.all(
      SOURCE_KEYS.map((source) => fetchSourceLogs(source, since, perSourceLimit, false)),
    );

    const combined = sourceResults
      .flatMap((entry) => entry.logs)
      .sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime())
      .slice(0, limit);

    res.json(combined);
  } catch (error) {
    console.error("Combined log fetch error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
