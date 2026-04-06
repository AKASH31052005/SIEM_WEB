const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
    systemName: String,
    logType: String,
    eventId: Number,
    message: String,
    severity: {
        type: String,
        enum: ["Low", "Medium", "High", "Critical"]
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Log", logSchema);
