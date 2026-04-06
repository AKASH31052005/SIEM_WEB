const Alert = require("../models/Alert");

async function correlateAlerts(host) {

    try {

        const alerts = await Alert.find({
            source: host
        }).sort({ createdAt: -1 }).limit(20);

        let bruteForce = false;
        let maliciousIP = false;
        let ueba = false;

        alerts.forEach(alert => {

            if (alert.type === "ML_ANOMALY")
                bruteForce = true;

            if (alert.type === "THREAT_INTEL_API")
                maliciousIP = true;

            if (alert.type === "UEBA_ANOMALY")
                ueba = true;

        });

        if (bruteForce && maliciousIP && ueba) {

            console.log("🚨 ATTACK CORRELATION: ACCOUNT COMPROMISE");

            const correlatedAlert = new Alert({

                type: "ACCOUNT_COMPROMISE",

                message: "Multiple attack indicators detected",
                severity: "Critical",
                source: host

            });

            await correlatedAlert.save();

        }

    } catch (err) {

        console.error("Correlation Engine Error:", err.message);

    }

}

module.exports = correlateAlerts;