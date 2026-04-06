const { exec } = require("child_process");
const NetworkLog = require("./models/NetworkLog");
const { createAlertIfNotExists } = require("./utils/alertHelper");
const processLog = require("./services/logProcessor");

// ============================
// CONFIG (VERY IMPORTANT)
// ============================

const MAX_CONNECTIONS = 30;        // Limit per cycle
const INTERVAL = 30000;           // 30 seconds
const CLEANUP_INTERVAL = 300000;  // 5 minutes

const SUSPICIOUS_PORTS = [4444, 1337, 6667, 3389, 22, 23, 445];

let connectionTracker = {};
let portScanTracker = {};

// ============================
// NETWORK MONITORING START
// ============================

function startNetworkMonitoring() {

  console.log("🌐 Network Monitoring Started (Optimized Mode)");

  setInterval(() => {

    exec("netstat -ano", (err, stdout) => {

      if (err) {
        console.error("❌ Netstat Error:", err.message);
        return;
      }

      const lines = stdout.split("\n");

      let count = 0;

      for (let line of lines) {

        if (count >= MAX_CONNECTIONS) break;
        if (!line.includes("TCP")) continue;

        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;

        const protocol = parts[0];
        const local = parts[1];
        const foreign = parts[2];

        const [srcIP, srcPort] = local.split(":");
        const [destIP, destPort] = foreign.split(":");

        // Skip invalid or noisy traffic
        if (!destPort || !srcIP || !destIP) continue;
        if (destIP === "127.0.0.1" || destIP === "0.0.0.0") continue;

        const numericDestPort = parseInt(destPort);
        const numericSrcPort = parseInt(srcPort);

        if (isNaN(numericDestPort) || isNaN(numericSrcPort)) continue;

        count++;

        const logData = {
          srcIP,
          destIP,
          srcPort: numericSrcPort,
          destPort: numericDestPort,
          protocol,
          action: "ALLOW",
          bytesTransferred: 0,
          direction: "OUTBOUND"
        };

        // 🔹 Non-blocking DB insert
        NetworkLog.create(logData).then(savedLog => {
          if (global.io) {
            global.io.emit("newLog", {
              ...savedLog.toObject(),
              logType: "network",
              timestamp: savedLog.timestamp || savedLog.createdAt
            });
          }
        }).catch(err =>
          console.error("DB Error:", err.message)
        );

        console.log(
          `🌐 ${srcIP}:${numericSrcPort} -> ${destIP}:${numericDestPort}`
        );

        // 🔹 Non-blocking detection
        detectNetworkThreat(logData);

        // 🔹 OPTIONAL (disable if heavy)
        /*
        processLog("network", {
          ip: srcIP,
          source_ip: srcIP,
          dest_ip: destIP,
          port: numericDestPort,
          protocol,
          source: "network",
          failed_attempts: 0,
          request_count: 1,
          connection_count: 1,
          port_count: 1
        }).catch(console.error);
        */
      }

      console.log(`✅ Processed ${count} connections safely\n`);

    });

  }, INTERVAL);
}

// ============================
// DETECTION ENGINE (OPTIMIZED)
// ============================

async function detectNetworkThreat(log) {

  const now = Date.now();
  const ip = log.srcIP;
  const port = log.destPort;

  // ---------------------------
  // Suspicious Port Detection
  // ---------------------------

  if (SUSPICIOUS_PORTS.includes(port)) {

    console.log(`⚠ Suspicious Port: ${ip} -> ${port}`);

    createAlertIfNotExists(
      "Suspicious Port Access",
      `Connection to suspicious port ${port} from ${ip}`,
      "High",
      "Network Monitoring"
    ).catch(console.error);
  }

  // ---------------------------
  // Port Scan Detection
  // ---------------------------

  if (!portScanTracker[ip]) portScanTracker[ip] = [];

  portScanTracker[ip] = portScanTracker[ip]
    .filter(entry => now - entry.time < 60000);

  portScanTracker[ip].push({ port, time: now });

  const uniquePorts = new Set(portScanTracker[ip].map(e => e.port));

  if (uniquePorts.size >= 10) {

    console.log(`🚨 Port Scan Detected from ${ip}`);

    createAlertIfNotExists(
      "Port Scan Detected",
      `Possible port scan from ${ip}`,
      "Critical",
      "Network Monitoring"
    ).catch(console.error);

    portScanTracker[ip] = [];
  }

  // ---------------------------
  // Connection Flood Detection
  // ---------------------------

  if (!connectionTracker[ip]) connectionTracker[ip] = [];

  connectionTracker[ip] = connectionTracker[ip]
    .filter(ts => now - ts < 60000);

  connectionTracker[ip].push(now);

  if (connectionTracker[ip].length >= 20) {

    console.log(`🚨 Connection Flood from ${ip}`);

    createAlertIfNotExists(
      "Connection Flood Detected",
      `High number of connections from ${ip}`,
      "High",
      "Network Monitoring"
    ).catch(console.error);

    connectionTracker[ip] = [];
  }
}

// ============================
// MEMORY CLEANUP (VERY IMPORTANT)
// ============================

setInterval(() => {
  connectionTracker = {};
  portScanTracker = {};
  console.log("🧹 Memory cleaned (trackers reset)");
}, CLEANUP_INTERVAL);

// ============================
// AUTO START
// ============================

if (require.main === module) {
  startNetworkMonitoring();
}

// ============================
// EXPORT
// ============================

module.exports = startNetworkMonitoring;