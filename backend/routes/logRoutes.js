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

// Add log
router.post("/", async (req, res) => {
    try {
        console.log("🔥 STEP 1: API HIT");
        console.log("📥 Incoming Log:", req.body);

        // Save raw log
        const log = new Log(req.body);
        await log.save();

        console.log("🔥 STEP 2: LOG SAVED");

        // 🔥 NORMALIZATION
        try {
            await normalizeAndStore(log);
            console.log("🔥 STEP 3: NORMALIZATION DONE");
        } catch (normError) {
            console.error("❌ NORMALIZATION ERROR:", normError);
        }

        // 🚨 Brute Force Detection
        if (log.eventId === 4625) {

            console.log("🔥 STEP 4: DETECTION CHECK STARTED");

            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            const failedAttempts = await Log.countDocuments({
                systemName: log.systemName,
                eventId: 4625,
                timestamp: { $gte: fiveMinutesAgo }
            });

            console.log("🔥 Failed Attempts:", failedAttempts);

            if (failedAttempts >= 5) {

                console.log("🚨 ALERT TRIGGERED");

                const alert = new Alert({
                    type: "Brute Force Attack",
                    message: "Multiple failed login attempts detected",
                    severity: "High",
                    systemName: log.systemName
                });

                await alert.save();

                console.log("🔥 STEP 5: ALERT SAVED");

                // Emit real-time alert
                const io = req.app.get("io");
                if (io) {
                    io.emit("newAlert", alert);
                    console.log("🔥 STEP 6: ALERT EMITTED");
                }
            }
        }

        res.status(201).json(log);

    } catch (error) {
        console.error("❌ Log Save Error:", error);
        res.status(500).json({ message: error.message });
    }
});

router.post("/logs", async (req, res) => {
    try {
        console.log("📥 Log received from agent:", req.body);

        // Save log directly
        const log = new Log(req.body);
        await log.save();

        console.log("✅ Agent log saved");

        // 🔥 NORMALIZATION (optional but good)
        try {
            await normalizeAndStore(log);
        } catch (err) {
            console.error("Normalization error:", err);
        }

        // 🔥 REAL-TIME EMIT
        const io = req.app.get("io");
        if (io) {
            io.emit("new_log", log);
            console.log("⚡ Real-time log emitted");
        }

        res.status(200).json({ message: "Log received" });

    } catch (error) {
        console.error("❌ Agent Log Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// Get all logs (Raw Logs)
router.get("/", async (req, res) => {
    try {
        const timeRange = req.query.timeRange || "all";
        let dateFilter = {};
        if (timeRange !== "all") {
            const now = Date.now();
            let limit;
            if (timeRange === "15m") limit = now - 15 * 60 * 1000;
            else if (timeRange === "1h") limit = now - 60 * 60 * 1000;
            else if (timeRange === "24h") limit = now - 24 * 60 * 60 * 1000;
            else if (timeRange === "7d") limit = now - 7 * 24 * 60 * 60 * 1000;

            if (limit) {
                dateFilter = { $gte: new Date(limit) };
            }
        }

        const getFilter = (field) => {
            if (Object.keys(dateFilter).length === 0) return {};
            return {
                $or: [
                    { [field]: dateFilter },
                    { createdAt: dateFilter }
                ]
            };
        };

        const [
            logs,
            windowsLogs,
            linuxLogs,
            webLogs,
            networkLogs,
            appLogs,
            dbLogs
        ] = await Promise.all([
            Log.find(getFilter('timestamp')).sort({ timestamp: -1 }).limit(5000),
            WindowsLog.find(getFilter('TimeCreated')).sort({ TimeCreated: -1, createdAt: -1 }).limit(5000),
            LinuxLog.find(getFilter('Timestamp')).sort({ Timestamp: -1, createdAt: -1 }).limit(5000),
            WebLog.find(getFilter('Timestamp')).sort({ Timestamp: -1, createdAt: -1 }).limit(5000),
            NetworkLog.find(getFilter('timestamp')).sort({ timestamp: -1 }).limit(5000),
            ApplicationLog.find(getFilter('timestamp')).sort({ timestamp: -1 }).limit(5000),
            DatabaseLog.find(getFilter('timestamp')).sort({ timestamp: -1 }).limit(5000)
        ]);

        const combinedLogs = [
            ...logs.map(l => ({ ...l.toObject(), logType: l.logType || 'system' })),
            ...windowsLogs.map(l => ({ ...l.toObject(), logType: 'windows', timestamp: l.TimeCreated || l.createdAt })),
            ...linuxLogs.map(l => ({
                ...l.toObject(),
                logType: 'linux',
                timestamp: l.Timestamp || l.createdAt,
                hostname: l.Host,
                message: l.Message
            })),
            ...webLogs.map(l => ({
                ...l.toObject(),
                logType: 'web',
                timestamp: l.Timestamp || l.createdAt,
                method: l.Method || l.method || "UNKNOWN",
                url: l.URL || l.url || l.endpoint || "/",
                status: l.StatusCode || l.statusCode || l.status || "—",
                ip: l.IP || l.ip || "unknown",
                userAgent: l.UserAgent || l.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" // default to realistic UA if missing
            })),
            ...networkLogs.map(l => ({ ...l.toObject(), logType: 'network', timestamp: l.timestamp || l.Timestamp || l.createdAt })),
            ...appLogs.map(l => ({ ...l.toObject(), logType: 'application', timestamp: l.timestamp || l.createdAt })),
            ...dbLogs.map(l => ({
                ...l.toObject(),
                logType: 'database',
                timestamp: l.timestamp || l.createdAt,
                event_category: 'database',
                method: l.operationType,
                message: `Database operation: ${l.operationType} on collection ${l.collection}`
            }))
        ];

        combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(combinedLogs);
    } catch (error) {
        console.error("Error fetching logs:", error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;