const express = require("express");
const router = express.Router();
const AIExplanation = require("../models/AIExplanation");

router.get("/:alertId", async (req, res) => {
    const data = await AIExplanation.findOne({
        alertId: req.params.alertId
    });

    res.json(data);
});

module.exports = router;