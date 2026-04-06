const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");

/* ===============================
   GET ALL ALERTS
================================= */

router.get("/", async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "all";
    let dateFilter = {};
    if (timeRange !== "all") {
        const now = Date.now();
        let limit;
        if (timeRange === "15m") limit = now - 15 * 60 * 1000;
        else if (timeRange === "1h") limit = now - 60 * 60 * 1000;
        else if (timeRange === "24h") limit = now - 24 * 60 * 60 * 1000;
        else if (timeRange === "7d") limit = now - 7 * 24 * 60 * 60 * 1000;

        if (limit) {
            dateFilter = { createdAt: { $gte: new Date(limit) } };
        }
    }

    const alerts = await Alert
      .find(dateFilter)
      .sort({ createdAt: -1 });

    res.json(alerts);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

/* ===============================
   RESOLVE ALERT
================================= */

router.put("/:id", async (req, res) => {

  try {

    const updatedAlert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: "Resolved" },
      { new: true }
    );

    if (!updatedAlert) {

      return res.status(404).json({
        message: "Alert not found"
      });

    }

    res.json(updatedAlert);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

module.exports = router;