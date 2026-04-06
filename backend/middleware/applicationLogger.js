const ApplicationLog = require("../models/ApplicationLog");

async function applicationLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", async () => {
    try {
      const severity =
        res.statusCode >= 500
          ? "high"
          : res.statusCode >= 400
          ? "medium"
          : "low";

      const savedLog = await ApplicationLog.create({
        user: req.user?.username || "anonymous",
        ip_address: req.ip,
        event_category: "api",
        event_action: "access_api",
        endpoint: req.originalUrl,
        method: req.method,
        status_code: res.statusCode,
        severity,
        message: "API accessed"
      });

      if (global.io) {
        global.io.emit("newLog", {
          ...savedLog.toObject(),
          logType: "application",
          timestamp: savedLog.timestamp || savedLog.createdAt
        });
      }
    } catch (err) {
      console.error("Application Log Error:", err.message);
    }
  });

  next();
}

module.exports = applicationLogger;