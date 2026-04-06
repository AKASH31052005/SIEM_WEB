const mongoose = require("mongoose");

const riskScoreSchema = new mongoose.Schema({

    host: {
        type: String,
        required: true
    },

    score: {
        type: Number,
        default: 0
    },

    level: {
        type: String,
        enum: ["Low", "Medium", "High", "Critical"],
        default: "Low"
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("RiskScore", riskScoreSchema);