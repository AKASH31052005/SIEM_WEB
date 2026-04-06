const parseWindowsLog = require("../parsers/windowsParser");
const parseLinuxLog = require("../parsers/linuxParser");
const parseWebLog = require("../parsers/webParser");

const parseDatabaseLog = require("../parsers/databaseParser");
const parseNetworkLog = require("../parsers/networkParser");
const parseFileIntegrityLog = require("../parsers/fileIntegrityParser");
const parseApplicationLog = require("../parsers/applicationParser");

const runDetection = require("../engine/detectionEngine");

const detectAnomaly = require("./mlService");
const Alert = require("../models/Alert");
const { spawn } = require("child_process");

const updateRisk = require("../engine/riskEngine");
const correlateAlerts = require("../engine/correlationEngine");
const runSOAR = require("./soarEngine");
const handleAIExplanation = require("./aiHandler");

/* ==============================
   SAFE ALERT EMITTER
============================== */
function emitAlert(alert) {
    if (global.io) {
        console.log("📡 Emitting ALERT");
        global.io.emit("new_alert", alert); // ✅ FIXED EVENT NAME
    } else {
        console.log("⚠️ Socket.IO not initialized");
    }
}

/* ==============================
   SAFE LOG EMITTER
============================== */
function emitLog(log) {
    if (global.io) {
        global.io.emit("new_log", log); // ✅ FIXED EVENT NAME
    }
}

/* ==============================
   🔥 HELPER: ENSURE IP EXISTS
============================== */
function ensureIP(log) {
    return log.ip || log.source_ip || log.client_ip || "192.168.1.100";
}

/* ==============================
   PYTHON PROCESS HANDLER
============================== */
function handlePythonProcess(py, onDataCallback) {

    py.stdout.on("data", async (data) => {
        try {
            await onDataCallback(data.toString().trim());
        } catch (err) {
            console.error("❌ Python Callback Error:", err);
        }
    });

    py.stderr.on("data", (err) => {
        console.error("❌ Python Error:", err.toString());
    });

    py.on("close", (code) => {
        if (code !== 0) {
            console.log(`⚠️ Python process exited with code ${code}`);
        }
    });
}

/* ==============================
   UEBA AI ENGINE
============================== */
function runUEBA(features, parsedLog) {

    const py = spawn("python", [
        "./ai/uebaDetect.py",
        JSON.stringify(features)
    ]);

    handlePythonProcess(py, async (result) => {

        if (result === "ANOMALY") {

            console.log("🚨 UEBA ALERT");

            const alert = new Alert({
                type: "UEBA_ANOMALY",
                message: "Suspicious user activity detected",
                severity: "High",
                source: "AI Engine"
            });

            await alert.save();
            emitAlert(alert);
            handleAIExplanation(alert);

            parsedLog.ip = ensureIP(parsedLog);

            console.log("🔥 CALLING SOAR...");
            await runSOAR(alert, parsedLog);

            await updateRisk("unknown", "UEBA_ANOMALY");
        }
    });
}

/* ==============================
   NETWORK AI ENGINE
============================== */
function runNetworkAI(features, parsedLog) {

    const py = spawn("python", [
        "./ai/networkDetect.py",
        JSON.stringify(features)
    ]);

    handlePythonProcess(py, async (result) => {

        if (result === "NETWORK_ANOMALY") {

            console.log("🚨 NETWORK ATTACK");

            const alert = new Alert({
                type: "NETWORK_AI_ALERT",
                message: "Suspicious network traffic detected",
                severity: "Critical",
                source: "Network AI"
            });

            await alert.save();
            emitAlert(alert);
            handleAIExplanation(alert);

            parsedLog.ip = ensureIP(parsedLog);

            await runSOAR(alert, parsedLog);

            await updateRisk("unknown", "NETWORK_AI_ALERT");
        }
    });
}

/* ==============================
   THREAT INTEL
============================== */
function runThreatIntel(log) {

    const py = spawn("python", [
        "./ai/threatIntelDetect.py",
        JSON.stringify(log)
    ]);

    handlePythonProcess(py, async (result) => {

        if (result === "MALICIOUS_IP" || result === "MALICIOUS_DOMAIN") {

            console.log("🚨 THREAT INTEL");

            const alert = new Alert({
                type: result,
                message: "Threat Intelligence detection",
                severity: "Critical",
                source: "Threat Intelligence"
            });

            await alert.save();
            emitAlert(alert);
            handleAIExplanation(alert);

            log.ip = ensureIP(log);

            await runSOAR(alert, log);

            await updateRisk("unknown", result);
        }
    });
}

/* ==============================
   THREAT INTEL API
============================== */
function runThreatIntelAPI(log) {

    const py = spawn("python", [
        "./ai/threatIntelAPI.py",
        JSON.stringify(log)
    ]);

    handlePythonProcess(py, async (result) => {

        if (result === "MALICIOUS_IP") {

            console.log("🚨 THREAT INTEL API");

            const alert = new Alert({
                type: "THREAT_INTEL_API",
                message: "Known malicious IP detected",
                severity: "Critical",
                source: "Threat Intel API"
            });

            await alert.save();
            emitAlert(alert);
            handleAIExplanation(alert);

            log.ip = ensureIP(log);

            await runSOAR(alert, log);

            await updateRisk("unknown", "THREAT_INTEL_API");
        }
    });
}

/* ==============================
   FEATURE EXTRACTION
============================== */
function extractFeatures(log) {
    return [
        log.login_hour || new Date().getHours(),
        log.failed_attempts || 0,
        log.request_count || 0,
        log.connection_count || 0,
        log.port_count || 0
    ];
}

/* ==============================
   MAIN PROCESSOR
============================== */

async function processLog(source, rawLog) {

    try {
        console.log("🔥 PROCESS LOG FUNCTION CALLED");
        console.log("📥 Incoming Log Source:", source);

        let parsedLog;

        switch (source) {

            case "windows": parsedLog = parseWindowsLog(rawLog); break;
            case "linux": parsedLog = parseLinuxLog(rawLog); break;
            case "web": parsedLog = parseWebLog(rawLog); break;
            case "database": parsedLog = parseDatabaseLog(rawLog); break;
            case "network": parsedLog = parseNetworkLog(rawLog); break;
            case "file_integrity": parsedLog = parseFileIntegrityLog(rawLog); break;
            case "application": parsedLog = parseApplicationLog(rawLog); break;

            default:
                console.log("⚠ Unknown log source");
                return;
        }

        if (!parsedLog) {
            console.log("❌ Parsing failed");
            return;
        }

        console.log("🔎 Parsed Log:", parsedLog);

        console.log("➡️ Feature Extraction");
        const features = extractFeatures(parsedLog);

        console.log("➡️ Running ML Detection");
        const result = await detectAnomaly(features);

        if (result && result.anomaly) {

            console.log("🚨 ML ANOMALY");

            const alert = new Alert({
                type: "ML_ANOMALY",
                message: "AI detected abnormal behavior",
                severity: "High",
                source: parsedLog.source || source
            });

            await alert.save();
            emitAlert(alert);
            handleAIExplanation(alert);

            parsedLog.ip = ensureIP(parsedLog);

            await runSOAR(alert, parsedLog);
            await updateRisk("unknown", "ML_ANOMALY");
        }

        console.log("➡️ Running UEBA");
        runUEBA(features, parsedLog);

        console.log("➡️ Running Network AI");
        runNetworkAI(features, parsedLog);

        console.log("➡️ Running Threat Intel");
        runThreatIntel(parsedLog);

        console.log("➡️ Running Threat Intel API");
        runThreatIntelAPI(parsedLog);

        console.log("➡️ Running Correlation");
        await correlateAlerts(parsedLog.host || "unknown");

        console.log("➡️ Running Detection Engine");
        await runDetection(parsedLog);

        emitLog(parsedLog);

        console.log("✅ Detection completed\n");

    } catch (err) {
        console.error("❌ PIPELINE CRASH:", err);
    }
}

module.exports = processLog;