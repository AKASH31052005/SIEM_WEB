const si = require("systeminformation");
const Log = require("../models/Log");
const Alert = require("../models/Alert");
const os = require("os");

const startCPUMonitor = (app) => {

  const systemName = os.hostname(); // 🔥 Dynamic hostname

  console.log(`🔥 System Monitor Started for ${systemName}...`);

  setInterval(async () => {
    try {

      const io = app.get("io");

      // 🔹 CPU
      const cpuLoad = await si.currentLoad();
      const cpuUsage = parseFloat(cpuLoad.currentLoad.toFixed(2));

      // 🔹 MEMORY
      const memory = await si.mem();
      const memoryUsage = parseFloat(
        ((memory.used / memory.total) * 100).toFixed(2)
      );

      // 🔹 DISK
      const disk = await si.fsSize();
      const diskUsage = parseFloat(disk[0].use.toFixed(2));

      console.log(
        `CPU: ${cpuUsage}% | Memory: ${memoryUsage}% | Disk: ${diskUsage}%`
      );

      // ✅ Save CPU log
      const cpuLog = await new Log({
        systemName,
        logType: "Performance",
        message: `CPU Usage: ${cpuUsage}%`,
        severity: cpuUsage > 80 ? "Critical" : "Low"
      }).save();

      io.emit("newLog", cpuLog);

      // ✅ Save Memory log
      const memoryLog = await new Log({
        systemName,
        logType: "Performance",
        message: `Memory Usage: ${memoryUsage}%`,
        severity: memoryUsage > 80 ? "High" : "Low"
      }).save();

      io.emit("newLog", memoryLog);

      // ✅ Save Disk log
      const diskLog = await new Log({
        systemName,
        logType: "Performance",
        message: `Disk Usage: ${diskUsage}%`,
        severity: diskUsage > 85 ? "High" : "Low"
      }).save();

      io.emit("newLog", diskLog);

      // 🚨 Alerts

      if (cpuUsage > 80) {
        const alert = await new Alert({
          type: "CPU Spike",
          message: `High CPU usage detected: ${cpuUsage}%`,
          severity: "Critical",
          systemName
        }).save();

        io.emit("newAlert", alert);
      }

      if (memoryUsage > 80) {
        const alert = await new Alert({
          type: "Memory Spike",
          message: `High Memory usage detected: ${memoryUsage}%`,
          severity: "High",
          systemName
        }).save();

        io.emit("newAlert", alert);
      }

      if (diskUsage > 85) {
        const alert = await new Alert({
          type: "Disk Space Critical",
          message: `Disk usage exceeded: ${diskUsage}%`,
          severity: "High",
          systemName
        }).save();

        io.emit("newAlert", alert);
      }

    } catch (error) {
      console.log("System Monitor Error:", error);
    }

  }, 15000);
};

module.exports = startCPUMonitor;
