const mongoose = require("mongoose");

const aiExplanationSchema = new mongoose.Schema({
    alertId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Alert"
    },
    explanation: String,
    summary: String,
    severityReason: String,
    suggestedActions: [String]
}, { timestamps: true });

module.exports = mongoose.model("AIExplanation", aiExplanationSchema);