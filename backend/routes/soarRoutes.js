const express = require("express");
const router = express.Router();
const SoarLog = require("../models/SoarLog");

router.get("/", async (req, res) => {

    const logs = await SoarLog.find()
        .sort({ timestamp: -1 })
        .limit(20);

    res.json(logs);
});

module.exports = router;