const express = require("express");
const router = express.Router();
const Metrics = require("../models/Metrics");
const WindowsLog = require("../models/WindowsLog");
const { createAlertIfNotExists } = require("../utils/alertHelper");

/* =====================================
   BRUTE FORCE TRACKER
===================================== */
const failedLoginTracker = {};
const WINDOWS_HEARTBEAT_STALE_MS = 90000;

function pickFirstValue(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
}

function normalizeWindowsLog(raw = {}) {
    const eventRecordIdRaw = pickFirstValue(raw.EventRecordID, raw.eventRecordId, raw.recordId);
    const eventIdRaw = pickFirstValue(raw.EventID, raw.eventId, raw.id);
    const timeCreatedRaw = pickFirstValue(raw.TimeCreated, raw.timeCreated, raw.timestamp, raw.createdAt);

    const eventRecordId = Number(eventRecordIdRaw);
    const eventId = Number(eventIdRaw);
    const timeCreatedDate = timeCreatedRaw ? new Date(timeCreatedRaw) : new Date();
    const isValidTime = !Number.isNaN(timeCreatedDate.getTime());

    return {
        LogType: String(pickFirstValue(raw.LogType, raw.logType, "Security")),
        EventRecordID: Number.isFinite(eventRecordId) ? eventRecordId : null,
        EventID: Number.isFinite(eventId) ? eventId : null,
        TimeCreated: isValidTime ? timeCreatedDate : new Date(),
        Level: String(pickFirstValue(raw.Level, raw.level, "Information")),
        MachineName: String(pickFirstValue(raw.MachineName, raw.machineName, raw.hostname, "unknown")),
        Message: String(pickFirstValue(raw.Message, raw.message, "")),
        Username: String(pickFirstValue(raw.Username, raw.username, "unknown")),
        LogonType: pickFirstValue(raw.LogonType, raw.logonType, null),
        SourceIP: String(pickFirstValue(raw.SourceIP, raw.sourceIP, raw.srcIP, "unknown")),
        Status: pickFirstValue(raw.Status, raw.status, null),
        Category: pickFirstValue(raw.Category, raw.category, null),
    };
}

/* =====================================
   WINDOWS DETECTION ENGINE
===================================== */
async function detectWindowsThreat(log) {

    const eventId = Number(log.EventID);
    const ip = log.SourceIP || "unknown";

    // 4625 → Failed Login
    if (eventId === 4625) {
        if (!failedLoginTracker[ip]) failedLoginTracker[ip] = [];
        const now = Date.now();
        failedLoginTracker[ip] = failedLoginTracker[ip].filter(ts => now - ts < 120000);
        failedLoginTracker[ip].push(now);
        if (failedLoginTracker[ip].length >= 5) {
            await createAlertIfNotExists("Brute Force Attempt", `Multiple failed logins from ${ip}`, "High", "Windows Security Log");
            failedLoginTracker[ip] = [];
        }
    }

    // 4672 → Privilege Escalation
    if (eventId === 4672) {
        await createAlertIfNotExists("Privilege Escalation", `Special privileges assigned to ${log.Username}`, "High", "Windows Security Log");
    }

    // 4740 → Account Locked
    if (eventId === 4740) {
        await createAlertIfNotExists("Account Locked", `Account locked: ${log.Username}`, "Medium", "Windows Security Log");
    }

    // 4720 → New User Created
    if (eventId === 4720) {
        await createAlertIfNotExists("New User Created", `New user created: ${log.Username}`, "High", "Windows Security Log");
    }
}

/* =====================================
   AGENT LOG ENDPOINT (POST /api/agent)
===================================== */
router.post("/", async (req, res) => {
    console.log("Incoming Windows Log:", req.body);
    try {
        const logData = normalizeWindowsLog(req.body);
        global.lastWindowsAgentHeartbeatAt = Date.now();
        const dedupeFilter = {
            LogType: logData.LogType || "Security",
            MachineName: logData.MachineName || "unknown",
            TimeCreated: logData.TimeCreated || null,
        };

        if (Number.isFinite(logData.EventRecordID)) {
            dedupeFilter.EventRecordID = logData.EventRecordID;
        }
        if (Number.isFinite(logData.EventID)) {
            dedupeFilter.EventID = logData.EventID;
        }

        const existing = await WindowsLog.findOne(dedupeFilter).lean();
        if (existing) {
            return res.status(200).json({ message: "Duplicate log ignored" });
        }

        const savedLog = await WindowsLog.create(logData);
        await detectWindowsThreat(savedLog);

        if (global.io) {
            const payload = {
                ...savedLog.toObject(),
                source: "windows",
                logType: "windows",
                timestamp: savedLog.TimeCreated || savedLog.createdAt
            };
            global.io.emit("newLog", payload);
            global.io.emit("new_log", payload);
        }

        res.status(200).json({ message: "Windows log received" });
    } catch (err) {
        if (err.code === 11000) return res.status(200).json({ message: "Duplicate log ignored" });
        console.error("Windows log error:", err.message);
        res.status(500).json({ error: "Failed to save log" });
    }
});

router.get("/windows-health", async (req, res) => {
    try {
        const now = Date.now();
        const lastHeartbeatAt = Number(global.lastWindowsAgentHeartbeatAt || 0);
        const stale = !lastHeartbeatAt || (now - lastHeartbeatAt > WINDOWS_HEARTBEAT_STALE_MS);
        const latestLog = await WindowsLog.findOne().sort({ TimeCreated: -1, createdAt: -1 }).lean();

        res.json({
            status: stale ? "stale" : "healthy",
            stale,
            lastHeartbeatAt: lastHeartbeatAt ? new Date(lastHeartbeatAt).toISOString() : null,
            lastLogAt: latestLog?.TimeCreated || latestLog?.createdAt || null,
            totalWindowsLogs: await WindowsLog.countDocuments(),
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("Windows health error:", err.message);
        res.status(500).json({ error: "Failed to load windows health" });
    }
});

/* =====================================
   LIVE SYSTEM METRICS (GET /api/agent/metrics)
   Uses systeminformation for real-time data.
===================================== */
let si = null;
try { si = require("systeminformation"); } catch (e) { console.warn("systeminformation not available"); }

let _cachedMetrics = null;
let _lastFetch = 0;

router.get("/metrics", async (req, res) => {
    try {
        const now = Date.now();

        // Serve cached data within 3-second window
        if (_cachedMetrics && now - _lastFetch < 3000) {
            return res.json(_cachedMetrics);
        }

        if (!si) {
            // Fall back to pushed metrics from PowerShell agent
            if (_cachedMetrics) return res.json(_cachedMetrics);
            return res.status(503).json({ error: "systeminformation not installed and no pushed metrics" });
        }

        const [cpu, mem, disk, net, osInfo] = await Promise.all([
            si.currentLoad().catch(() => null),
            si.mem().catch(() => null),
            si.fsSize().catch(() => []),
            si.networkStats().catch(() => []),
            si.osInfo().catch(() => null),
        ]);

        const memFormatted = mem ? {
            ...mem,
            usedPercent: mem.total > 0 ? parseFloat(((mem.used / mem.total) * 100).toFixed(1)) : 0,
        } : null;

        const diskFormatted = Array.isArray(disk) ? disk.map(d => ({
            ...d,
            usedPercent: d.size > 0 ? parseFloat(((d.used / d.size) * 100).toFixed(1)) : 0,
        })) : [];

        _cachedMetrics = {
            cpu,
            mem: memFormatted,
            disk: diskFormatted,
            net,
            os: osInfo,
            timestamp: new Date().toISOString(),
        };
        _lastFetch = now;

        // Broadcast via Socket.IO
        if (global.io) global.io.emit("metricsUpdate", _cachedMetrics);

        res.json(_cachedMetrics);

    } catch (err) {
        console.error("Metrics error:", err.message);
        res.status(500).json({ error: "Failed to collect metrics" });
    }
});

/* Metrics PUSH from PowerShell agent (POST /api/agent/metrics) */
router.post("/metrics", async (req, res) => {

  const data = req.body;

  console.log("Incoming Metrics:", data);
  if (data && (data.agentType === "windows_collector" || data.collector === "windows-agent")) {
    global.lastWindowsAgentHeartbeatAt = Date.now();
  }

  try {
    await Metrics.create({
      cpu: data.cpu,
      mem: data.mem,
      disk: data.disk,
      net: data.net,
      os: data.os,
      timestamp: data.timestamp
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Metrics Error:", err.message);
    res.status(500).json({ error: "Failed" });
  }
});
module.exports = router;
