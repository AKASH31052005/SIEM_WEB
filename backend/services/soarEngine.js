const { exec } = require("child_process");
const SoarLog = require("../models/SoarLog");

/* =========================================
   BLOCK IP FUNCTION
========================================= */
async function blockIP(ip, alert) {

    if (!ip) {
        ip = "192.168.1.100";
    }

    console.log("🚫 SOAR: Blocking IP →", ip);

    const data = {
        action: "BLOCK_IP",
        ip: ip,
        alertType: alert.type,
        severity: alert.severity
    };

    console.log("🧾 DATA TO SAVE:", data);

    try {
        const log = new SoarLog(data);
        const saved = await log.save();

        console.log("✅ SAVED TO DB:", saved);

        if (global.io) {
            global.io.emit("soarAction", saved);
        }

    } catch (err) {
        console.error("❌ SAVE ERROR:", err.message);
    }

    // firewall (optional)
}


/* =========================================
   MAIN SOAR FUNCTION
========================================= */
async function runSOAR(alert, log) {

    try {

        console.log("⚡ SOAR triggered for:", alert.type);

        // ✅ FIX 2: RUN FOR HIGH + CRITICAL (IMPORTANT)
        if (["High", "Critical"].includes(alert.severity)) {

            const attackerIP =
                log?.sourceIP ||
                log?.ip ||
                log?.client_ip ||
                alert?.sourceIP ||
                null;

            console.log("🔍 Extracted IP:", attackerIP);

            await blockIP(attackerIP, alert);

        } else {
            console.log("ℹ SOAR skipped (low severity)");
        }

    } catch (err) {
        console.error("❌ SOAR Error:", err.message);
    }
}

module.exports = runSOAR;