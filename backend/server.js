require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const os = require("os");
const { exec } = require("child_process");
const path = require("path");

const applicationLogger = require("./middleware/applicationLogger");
const dashboardRoutes = require("./routes/dashboardRoutes");

/* ===============================
   DETECTION ENGINE PIPELINE
================================= */
const processLog = require("./services/logProcessor");

const app = express();

/* ===============================
   MODELS
================================= */
const WebLog = require("./models/WebLog");
const WindowsLog = require("./models/WindowsLog");
const LinuxLog = require("./models/LinuxLog");
const Alert = require("./models/Alert");

/* ===============================
   ROUTES
================================= */
const agentRoutes = require("./routes/agentRoutes");
const databaseRoutes = require("./routes/databaseRoutes");
const networkRoutes = require("./routes/networkRoutes");
const alertRoutes = require("./routes/alertRoutes");
const logRoutes = require("./routes/logRoutes");
const soarRoutes = require("./routes/soarRoutes");
const aiRoutes = require("./routes/aiRoutes");

/* ===============================
   COLLECTORS
================================= */
const startLinuxRealtimeMonitoring = require("./linux-log-collector");
const startDatabaseMonitoring = require("./database-log-collector");
const startNetworkMonitoring = require("./network-log-collector");
const startFileIntegrityMonitoring = require("./fileIntegrityMonitor");

/* ===============================
   MIDDLEWARE
================================= */
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(express.json());
app.use(applicationLogger);

/* ===============================
   REGISTER ROUTES
================================= */
app.use("/api/agent", agentRoutes);
app.use("/api/database-logs", databaseRoutes);
app.use("/api/network-logs", networkRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/soar", soarRoutes);
app.use("/api/ai", aiRoutes);

/* ===============================
   TEST ROUTE
================================= */
app.get("/test-soar", async (req, res) => {
  console.log("🧪 TEST ROUTE HIT");

  const runSOAR = require("./services/soarEngine");

  const fakeAlert = {
    type: "TEST_ATTACK",
    severity: "Critical"
  };

  const fakeLog = {
    ip: "192.168.1.50"
  };

  await runSOAR(fakeAlert, fakeLog);

  res.send("✅ SOAR manually triggered");
});

/* ===============================
   INGEST APIs (REAL-TIME FIX ADDED)
================================= */
app.post("/api/ingest/windows", async (req, res) => {
  try {
    const log = new WindowsLog(req.body);
    const savedLog = await log.save();

    const io = req.app.get("io");
    io.emit("newLog", savedLog); // 🔥 REAL-TIME

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
    io.emit("newLog", savedLog); // 🔥 REAL-TIME

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
    io.emit("newLog", savedLog); // 🔥 REAL-TIME

    await processLog("web", req.body);

    res.json({ message: "Web log processed" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   DASHBOARD SUMMARY
================================= */
app.get("/api/dashboard-summary", async (req, res) => {
  try {
    const [
      totalWindowsLogs,
      totalWebLogs,
      totalLinuxLogs,
      totalAlerts
    ] = await Promise.all([
      WindowsLog.countDocuments(),
      WebLog.countDocuments(),
      LinuxLog.countDocuments(),
      Alert.countDocuments()
    ]);

    res.json({
      totalWindowsLogs,
      totalWebLogs,
      totalLinuxLogs,
      totalAlerts
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

app.get("/", (req, res) => {
  res.send("Server working");
});

/* ===============================
   WINDOWS AGENT AUTO REGISTER
================================= */
function ensureWindowsAgentScheduled() {
  if (process.platform !== "win32") return;

  const taskName = "SIEM Windows Agent";
  const scriptPath = path.join(__dirname, "windows-log-collector.ps1");

  exec(`schtasks /Query /TN "${taskName}"`, (err) => {
    if (!err) {
      console.log("✅ Windows Agent task already exists");
      return;
    }

    const command =
      `schtasks /Create /TN "${taskName}" ` +
      `/TR "powershell.exe -ExecutionPolicy Bypass -File \\"${scriptPath}\\"" ` +
      `/SC ONSTART /RL HIGHEST /F`;

    exec(command, (error) => {
      if (error) {
        console.error("❌ Failed to create Windows Agent task.");
        return;
      }

      console.log("🚀 Windows Agent registered successfully!");
    });
  });
}

/* ===============================
   START COLLECTORS
================================= */
function startCollectorsBasedOnOS() {
  const currentOS = os.platform();

  if (currentOS === "linux") {
    console.log("🟢 Linux detected → Starting Linux collector");
    startLinuxRealtimeMonitoring();

  } else if (currentOS === "win32") {
    console.log("🟢 Windows detected → Windows agent active");

  } else {
    console.log("Unsupported OS:", currentOS);
  }
}

/* ===============================
   MONGODB CONNECTION
================================= */
let collectorsStarted = false;

mongoose.connect(process.env.MONGO_URI, { autoIndex: true })
  .then(() => {
    console.log("✅ MongoDB connected");

    if (!collectorsStarted) {
      collectorsStarted = true;

      ensureWindowsAgentScheduled();
      startCollectorsBasedOnOS();
      startDatabaseMonitoring();
      startNetworkMonitoring();
      startFileIntegrityMonitoring();

      console.log("🚀 All collectors started safely");
    }
  })
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
  });

/* ===============================
   ERROR HANDLING
================================= */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

/* ===============================
   SERVER + SOCKET.IO (FINAL CORRECT SETUP)
================================= */
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});

app.set("io", io);
global.io = io;

io.on("connection", () => {
  console.log("📡 SOC Dashboard connected");
});

server.listen(PORT, () => {
  console.log(`🚀 SIEM Server running on port ${PORT}`);
});