const detectBruteForce = require("../detection/bruteForceDetector");
const detectPrivilegeEscalation = require("../detection/privilegeEscalationDetector");
const detectSuspiciousProcess = require("../detection/processAnomalyDetector");

const detectCredentialStuffing = require("../detection/credentialStuffingDetector");
const detectPortScan = require("../detection/portScanDetector");
const detectSuspiciousOutbound = require("../detection/suspiciousOutboundDetector");
const detectC2Traffic = require("../detection/c2TrafficDetector");

const generateAlert = require("./alertEngine");
const runSOAR = require("../services/soarEngine");

async function runDetection(log) {

    const detectors = [
        detectBruteForce,
        detectCredentialStuffing,
        detectPrivilegeEscalation,
        detectSuspiciousProcess,
        detectPortScan,
        detectSuspiciousOutbound,
        detectC2Traffic
    ];

    for (const detector of detectors) {

        const alertData = detector(log);

        if (alertData) {

            const alert = await generateAlert(alertData,log);

            // ✅ CONNECT SOAR HERE
            if (alert){
                await runSOAR(alert, log);
            }
            
            // ✅ emit alert
            if (global.io) {
                global.io.emit("newAlert", alert);
            }
        }
    }
}

module.exports = runDetection;