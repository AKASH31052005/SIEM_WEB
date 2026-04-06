const Alert = require("../models/Alert");

const FAILED_THRESHOLD = 5;
const TIME_WINDOW = 5 * 60 * 1000;

let failedByIP = {};
let failedByUser = {};

/* =====================================
   CREATE ALERT (Generic)
===================================== */
async function createAlert(type, message, severity, source) {

    try {

        const alert = await Alert.create({
            type,
            message,
            severity,
            source,
            status: "Open",
            timestamp: new Date()
        });

        console.log(`🚨 ALERT GENERATED: ${type} | ${message}`);

        return alert;

    } catch (err) {

        console.error("Alert Error:", err.message);

    }

}

/* =====================================
   CREATE ALERT IF NOT EXISTS
===================================== */
async function createAlertIfNotExists(type, message, severity, source) {

    try {

        const existing = await Alert.findOne({
            type,
            message,
            status: "Open"
        });

        if (!existing) {

            await createAlert(type, message, severity, source);

        }

    } catch (err) {

        console.error("Alert Error:", err.message);

    }

}

/* =====================================
   CLEAN OLD FAILED ATTEMPTS
===================================== */
function cleanOld(store) {

    const now = Date.now();

    for (let key in store) {

        store[key] = store[key].filter(
            time => now - time < TIME_WINDOW
        );

        if (store[key].length === 0) {

            delete store[key];

        }

    }

}

/* =====================================
   TRACK BRUTE FORCE
===================================== */
async function trackFailure(ip, username, source) {

    const now = Date.now();

    if (ip) {

        if (!failedByIP[ip]) failedByIP[ip] = [];

        failedByIP[ip].push(now);

    }

    if (username) {

        if (!failedByUser[username]) failedByUser[username] = [];

        failedByUser[username].push(now);

    }

    cleanOld(failedByIP);
    cleanOld(failedByUser);

    if (ip && failedByIP[ip]?.length >= FAILED_THRESHOLD) {

        await createAlertIfNotExists(
            "Brute Force (IP)",
            `Multiple failed logins from IP: ${ip}`,
            "High",
            source
        );

        failedByIP[ip] = [];

    }

    if (username && failedByUser[username]?.length >= FAILED_THRESHOLD) {

        await createAlertIfNotExists(
            "Brute Force (User)",
            `Multiple failed logins for user: ${username}`,
            "High",
            source
        );

        failedByUser[username] = [];

    }

}

/* =====================================
   MAIN ANALYZE LOG FUNCTION
===================================== */
async function analyzeLog(log) {

    try {

        /* -------------------------------
           Windows Failed Login
        -------------------------------- */

        if (log.EventID === 4625 && log.Message) {

            const ipMatch = log.Message.match(/Source Network Address:\s+(\S+)/);
            const userMatch = log.Message.match(/Account Name:\s+(\S+)/);

            const ip = ipMatch ? ipMatch[1] : null;
            const username = userMatch ? userMatch[1] : null;

            await trackFailure(ip, username, "Windows");

        }

        /* -------------------------------
           Linux Failed Login
        -------------------------------- */

        if (typeof log.message === "string" && log.message.includes("Failed password")) {

            const ipMatch = log.message.match(/from\s+(\S+)/);
            const userMatch = log.message.match(/for\s+(\S+)/);

            const ip = ipMatch ? ipMatch[1] : null;
            const username = userMatch ? userMatch[1] : null;

            await trackFailure(ip, username, "Linux");

        }

        /* -------------------------------
           File Integrity Alerts
        -------------------------------- */

        if (log.source === "fileIntegrity") {

            if (log.severity === "High") {

                await createAlertIfNotExists(
                    "Critical File Modified",
                    `Sensitive file modified: ${log.filePath}`,
                    "High",
                    "File Integrity"
                );

            }

        }

    } catch (err) {

        console.error("Analyze Log Error:", err.message);

    }

}

module.exports = {
    analyzeLog,
    createAlertIfNotExists
};