const express = require("express");
const router = express.Router();
const NetworkLog = require("../models/NetworkLog");

router.get("/", async (req, res) => {
  const logs = await NetworkLog.find().sort({ timestamp: -1 }).limit(100);
  res.json(logs);
});

module.exports = router;