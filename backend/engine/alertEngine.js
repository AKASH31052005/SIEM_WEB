const Alert = require("../models/Alert");
const runSOAR = require("../services/soarEngine");

async function generateAlert(data, log = null) {

    try {

        const alert = new Alert({
            type: data.type,
            message: data.message,
            severity: data.severity,
            systemName: data.source,
            sourceIP: data.ip,
            username: data.username
        });

        await alert.save();

        console.log("🚨 ALERT GENERATED:", data.type, data.message);

        if (global.io) {
            global.io.emit("newAlert", alert);
        }

        // ✅ SAFE: pass log if available, fallback to alert
        await runSOAR(alert, log || data);

        // ✅ VERY IMPORTANT (fixes detectionEngine)
        return alert;

    } catch (error) {

        console.error("Alert Error:", error);

        return null; // safe fallback
    }

}

module.exports = generateAlert;