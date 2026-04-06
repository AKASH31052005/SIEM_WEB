const fs = require("fs");
const express = require("express");
const { analyzeLog } = require("./utils/alertHelper");

const app = express();
app.use(express.json());

/* ===============================
   Supported Web Servers
================================= */

const webLogPaths = [
    { type: "Apache", path: "C:\\Apache24\\logs\\access.log" },
    { type: "Apache", path: "C:\\xampp\\apache\\logs\\access.log" },
    { type: "Nginx", path: "C:\\nginx\\logs\\access.log" }
];

const expressPath = "express-access.log";

/* ===============================
   Apache / Nginx Parser
================================= */

function parseApacheOrNginx(line) {

    const regex =
        /^(\S+) \S+ \S+ \[(.*?)\] "(\S+) (.*?) \S+" (\d{3}) (\S+)/;

    const match = line.match(regex);

    if (!match) return null;

    const rawTime = match[2];
    const formatted = rawTime.replace(":", " ");
    const dateObj = new Date(formatted);

    return {
        IP: match[1],
        Timestamp: dateObj,
        Method: match[3],
        URL: match[4],
        StatusCode: match[5],
        Size: match[6]
    };

}

/* ===============================
   Express Parser
================================= */

function parseExpress(line) {

    const parts = line.split(" ");

    if (parts.length < 5) return null;

    return {
        Timestamp: new Date(parts[0]),
        IP: parts[1],
        Method: parts[2],
        URL: parts[3],
        StatusCode: parts[4],
        Size: "0"
    };

}

/* ===============================
   Web Log Collector
================================= */

function collectWebLogs() {

    for (let server of webLogPaths) {

        if (fs.existsSync(server.path)) {

            const data = fs.readFileSync(server.path, "utf8");

            const lines = data
                .split("\n")
                .filter(l => l.trim() !== "");

            const parsed = lines
                .slice(-100)
                .map(parseApacheOrNginx)
                .filter(Boolean);

            console.log(`🌐 ${server.type} Logs Collected:`, parsed.length);

            return {
                ServerType: server.type,
                Logs: parsed
            };

        }

    }

    if (fs.existsSync(expressPath)) {

        const data = fs.readFileSync(expressPath, "utf8");

        const lines = data
            .split("\n")
            .filter(l => l.trim() !== "");

        const parsed = lines
            .slice(-100)
            .map(parseExpress)
            .filter(Boolean);

        console.log("🌐 Express Logs Collected:", parsed.length);

        return {
            ServerType: "Express",
            Logs: parsed
        };

    }

    return {
        ServerType: "None",
        Logs: []
    };

}

/* ===============================
   Express Middleware Monitoring
================================= */

app.use((req, res, next) => {

    const logData = {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    };

    analyzeLog(logData);

    console.log("🌍 Web Request:", logData);

    next();

});

/* ===============================
   Start Collector
================================= */

function startWebCollector() {

    console.log("🌐 Web Log Collector Started");

    setInterval(() => {

        const logs = collectWebLogs();

        if (logs && logs.Logs.length > 0) {

            console.log(`📊 ${logs.ServerType} logs detected`);

        }

    }, 15000);

}

/* ===============================
   Run if executed directly
================================= */

if (require.main === module) {

    startWebCollector();

}

/* ===============================
   Export for server.js
================================= */

module.exports = collectWebLogs;