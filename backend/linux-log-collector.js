const { spawn } = require("child_process");
const LinuxLog = require("./models/LinuxLog");

/* ===============================
   LINUX REAL-TIME MONITORING
================================= */

function startLinuxRealtimeMonitoring() {

    console.log("🐧 Linux Real-Time Monitoring Started...");

    // Check OS
    if (process.platform !== "linux") {
        console.log("⚠ Linux collector skipped (not running on Linux)");
        return;
    }

    try {

        const tailAuth = spawn("tail", ["-F", "/var/log/auth.log"]);
        const tailSyslog = spawn("tail", ["-F", "/var/log/syslog"]);

        /* ===============================
           AUTH.LOG MONITORING
        ================================= */

        tailAuth.stdout.on("data", async (data) => {

            const logLine = data.toString().trim();

            if (!logLine) return;

            try {

                await LinuxLog.create({
                    source: "auth.log",
                    message: logLine,
                    Timestamp: new Date()
                });

                console.log("🐧 AUTH LOG:", logLine);

            } catch (err) {

                console.log("Auth log error:", err.message);

            }

        });

        /* ===============================
           SYSLOG MONITORING
        ================================= */

        tailSyslog.stdout.on("data", async (data) => {

            const logLine = data.toString().trim();

            if (!logLine) return;

            try {

                await LinuxLog.create({
                    source: "syslog",
                    message: logLine,
                    Timestamp: new Date()
                });

                console.log("🐧 SYSLOG:", logLine);

            } catch (err) {

                console.log("Syslog error:", err.message);

            }

        });

        /* ===============================
           ERROR HANDLING
        ================================= */

        tailAuth.on("error", (err) => {
            console.log("Auth tail error:", err.message);
        });

        tailSyslog.on("error", (err) => {
            console.log("Syslog tail error:", err.message);
        });

    } catch (err) {

        console.log("Linux monitoring error:", err.message);

    }

}

/* ===============================
   AUTO START IF RUN DIRECTLY
================================= */

if (require.main === module) {

    startLinuxRealtimeMonitoring();

}

/* ===============================
   EXPORT FOR SERVER
================================= */

module.exports = startLinuxRealtimeMonitoring;