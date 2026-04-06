const express = require("express");
const router = express.Router();
const DatabaseLog = require("../models/DatabaseLog");

router.get("/", async (req, res) => {
  try {
    const ApplicationLog = require("../models/ApplicationLog");
    const [dbLogs, appLogs] = await Promise.all([
      DatabaseLog.find().sort({ timestamp: -1 }).limit(100).lean(),
      ApplicationLog.find().sort({ timestamp: -1 }).limit(100).lean()
    ]);

    // Map ApplicationLog to look like other logs if needed, or just combine
    const combined = [...dbLogs, ...appLogs].sort((a, b) => {
      const tA = new Date(b.timestamp || b.createdAt || 0).getTime();
      const tB = new Date(a.timestamp || a.createdAt || 0).getTime();
      return tA - tB; // descending
    }).slice(0, 100);

    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Application/Database logs" });
  }
});

module.exports = router;