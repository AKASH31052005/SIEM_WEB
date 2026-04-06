const Alert = require("../models/Alert");

exports.getDashboardStats = async (req, res) => {
  try {

    const totalAlerts = await Alert.countDocuments();

    const criticalAlerts = await Alert.countDocuments({
      severity: "Critical"
    });

    const highAlerts = await Alert.countDocuments({
      severity: "High"
    });

    const mediumAlerts = await Alert.countDocuments({
      severity: "Medium"
    });

    const lowAlerts = await Alert.countDocuments({
      severity: "Low"
    });

    res.json({
      totalAlerts,
      criticalAlerts,
      highAlerts,
      mediumAlerts,
      lowAlerts
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRecentAlerts = async (req, res) => {
  try {

    const alerts = await Alert.find()
      .sort({ timestamp: -1 })   // newest alerts first
      .limit(20);                // return only last 20 alerts

    res.json(alerts);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRiskScores = async (req, res) => {
  try {

    const systems = await Alert.aggregate([
      {
        $group: {
          _id: "$systemName",
          riskScore: { $sum: "$riskScore" }
        }
      },
      {
        $sort: { riskScore: -1 }
      }
    ]);

    res.json(systems);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};