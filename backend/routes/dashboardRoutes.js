const express = require("express");
const router = express.Router();

const {
  getDashboardStats,
  getRecentAlerts,
  getRiskScores
} = require("../controllers/dashboardController");

router.get("/stats", getDashboardStats);
router.get("/alerts", getRecentAlerts);
router.get("/risk-scores", getRiskScores);

module.exports = router;