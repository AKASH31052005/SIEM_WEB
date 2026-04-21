require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const os = require("os");
const { exec, spawn } = require("child_process");
const path = require("path");

const applicationLogger = require("./middleware/applicationLogger");
const dashboardRoutes = require("./routes/dashboardRoutes");
const processLog = require("./services/logProcessor");

const WebLog = require("./models/WebLog");
const WindowsLog = require("./models/WindowsLog");
const LinuxLog = require("./models/LinuxLog");
const Alert = require("./models/Alert");

const agentRoutes = require("./routes/agentRoutes");
const databaseRoutes = require("./routes/databaseRoutes");
const networkRoutes = require("./routes/networkRoutes");
const alertRoutes = require("./routes/alertRoutes");
const logRoutes = require("./routes/logRoutes");
const soarRoutes = require("./routes/soarRoutes");
const aiRoutes = require("./routes/aiRoutes");

const startLinuxRealtimeMonitoring = require("./linux-log-collector");
const startDatabaseMonitoring = require("./database-log-collector");
const startNetworkMonitoring = require("./network-log-collector");
const startFileIntegrityMonitoring = require("./fileIntegrityMonitor");

const PORT = process.env.PORT || 5000;
const WINDOWS_AGENT_BACKEND_URL =
  process.env.WINDOWS_AGENT_BACKEND_URL || `http://localhost:${PORT}`;
const WINDOWS_WATCHDOG_INTERVAL_MS = 30000;
const WINDOWS_HEARTBEAT_STALE_MS = 90000;

const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(applicationLogger);

app.use("/api/agent", agentRoutes);
app.use("/api/database-logs", databaseRoutes);
app.use("/api/network-logs", networkRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/soar", soarRoutes);
app.use("/api/ai", aiRoutes);

app.get("/test-soar", async (req, res) => {
  const runSOAR = require("./services/soarEngine");

  const fakeAlert = {
    type: "TEST_ATTACK",
    severity: "Critical",
  };

  const fakeLog = {
    ip: "192.168.1.50",
  };

  await runSOAR(fakeAlert, fakeLog);
  res.send("SOAR manually triggered");
});

app.post("/api/ingest/windows", async (req, res) => {
  try {
    const log = new WindowsLog(req.body);
    const savedLog = await log.save();

    const io = req.app.get("io");
    io.emit("newLog", savedLog);
    io.emit("new_log", savedLog);

    await processLog("windows", req.body);
    res.json({ message: "Windows log processed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ingest/linux", async (req, res) => {
  try {
    const log = new LinuxLog(req.body);
    const savedLog = await log.save();

    const io = req.app.get("io");
    io.emit("newLog", savedLog);
    io.emit("new_log", savedLog);

    await processLog("linux", req.body);
    res.json({ message: "Linux log processed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ingest/web", async (req, res) => {
  try {
    const log = new WebLog(req.body);
    const savedLog = await log.save();

    const io = req.app.get("io");
    io.emit("newLog", savedLog);
    io.emit("new_log", savedLog);

    await processLog("web", req.body);
    res.json({ message: "Web log processed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dashboard-summary", async (req, res) => {
  try {
    const [totalWindowsLogs, totalWebLogs, totalLinuxLogs, totalAlerts] = await Promise.all([
      WindowsLog.countDocuments(),
      WebLog.countDocuments(),
      LinuxLog.countDocuments(),
      Alert.countDocuments(),
    ]);

    res.json({
      totalWindowsLogs,
      totalWebLogs,
      totalLinuxLogs,
      totalAlerts,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

app.get("/", (req, res) => {
  res.send("Server working");
});

function runWindowsAgentTask(taskName) {
  exec(`schtasks /Run /TN "${taskName}"`, (runErr) => {
    if (runErr) {
      console.warn("Windows Agent scheduled task could not be started right now");
      if (!windowsCollectorProcess) {
        console.warn("Falling back to inline Windows collector process");
        startWindowsCollectorInline();
      }
      return;
    }
    console.log("Windows Agent scheduled task started");
  });
}

function ensureWindowsAgentScheduled() {
  if (process.platform !== "win32") return;

  const taskName = "SIEM Windows Agent";
  const scriptPath = path.join(__dirname, "windows-log-collector.ps1");

  exec(`schtasks /Query /TN "${taskName}"`, (queryErr) => {
    if (!queryErr) {
      console.log("Windows Agent task already exists");
      runWindowsAgentTask(taskName);
      return;
    }

    const createCommand =
      `schtasks /Create /TN "${taskName}" ` +
      `/TR "powershell.exe -ExecutionPolicy Bypass -File \\"${scriptPath}\\" -BackendUrl \\"${WINDOWS_AGENT_BACKEND_URL}\\"" ` +
      `/SC ONSTART /RL HIGHEST /F`;

    exec(createCommand, (createErr) => {
      if (createErr) {
        console.error("Failed to create Windows Agent scheduled task");
        if (!windowsCollectorProcess) {
          console.warn("Falling back to inline Windows collector process");
          startWindowsCollectorInline();
        }
        return;
      }

      console.log("Windows Agent task registered");
      runWindowsAgentTask(taskName);
    });
  });
}

let windowsCollectorProcess = null;

function startWindowsCollectorInline() {
  if (process.platform !== "win32") return;
  if (windowsCollectorProcess) return;

  const scriptPath = path.join(__dirname, "windows-log-collector.ps1");

  windowsCollectorProcess = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-BackendUrl",
      WINDOWS_AGENT_BACKEND_URL,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  windowsCollectorProcess.stdout.on("data", (data) => {
    const text = String(data || "").trim();
    if (text) {
      console.log(`[windows-agent] ${text}`);
    }
  });

  windowsCollectorProcess.stderr.on("data", (data) => {
    const text = String(data || "").trim();
    if (text) {
      console.error(`[windows-agent] ${text}`);
    }
  });

  windowsCollectorProcess.on("exit", (code) => {
    windowsCollectorProcess = null;
    console.warn(`Windows collector process exited with code ${code}`);
    setTimeout(() => {
      if (process.platform === "win32") {
        startWindowsCollectorInline();
      }
    }, 5000);
  });
}

function startCollectorsBasedOnOS() {
  const currentOS = os.platform();

  if (currentOS === "linux") {
    console.log("Linux detected, starting Linux collector");
    startLinuxRealtimeMonitoring();
    return;
  }

  if (currentOS === "win32") {
    console.log("Windows detected, starting Windows collector task");
    if (String(process.env.WINDOWS_AGENT_INLINE || "").toLowerCase() === "true") {
      console.log("WINDOWS_AGENT_INLINE=true, starting inline collector process");
      startWindowsCollectorInline();
    }
    return;
  }

  console.log(`Unsupported OS: ${currentOS}`);
}

let collectorsStarted = false;
let windowsWatchdogStarted = false;
let httpServerStarted = false;

function startWindowsCollectorWatchdog() {
  if (process.platform !== "win32") return;
  if (windowsWatchdogStarted) return;
  windowsWatchdogStarted = true;

  setInterval(() => {
    const heartbeatAt = Number(global.lastWindowsAgentHeartbeatAt || 0);
    const stale = !heartbeatAt || (Date.now() - heartbeatAt > WINDOWS_HEARTBEAT_STALE_MS);
    if (!stale) return;

    console.warn("Windows agent heartbeat is stale. Attempting recovery.");
    ensureWindowsAgentScheduled();

    if (!windowsCollectorProcess) {
      console.warn("Starting inline Windows collector as watchdog fallback");
      startWindowsCollectorInline();
    }
  }, WINDOWS_WATCHDOG_INTERVAL_MS);
}

mongoose
  .connect(process.env.MONGO_URI, { autoIndex: true })
  .then(() => {
    console.log("MongoDB connected");

    if (!collectorsStarted) {
      collectorsStarted = true;

      if (process.platform === "win32") {
        global.lastWindowsAgentHeartbeatAt = Number(global.lastWindowsAgentHeartbeatAt || 0);
        ensureWindowsAgentScheduled();
        startWindowsCollectorWatchdog();
      }
      startCollectorsBasedOnOS();
      startDatabaseMonitoring();
      startNetworkMonitoring();
      startFileIntegrityMonitoring();

      console.log("All collectors started safely");
    }

    if (!httpServerStarted) {
      server.listen(PORT, () => {
        console.log(`SIEM Server running on port ${PORT}`);
      });
      httpServerStarted = true;
    }
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);
global.io = io;

io.on("connection", () => {
  console.log("SOC Dashboard connected");
});
