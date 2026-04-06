const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({

    type: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true
    },

    severity: {
        type: String,
        enum: ["Low", "Medium", "High", "Critical"],
        default: "Low"
    },

    /* Which system generated the alert */
    source: {
        type: String,
        default: "Unknown"
    },

    /* Optional metadata */
    sourceIP: {
        type: String
    },

    username: {
        type: String
    },

    /* Alert lifecycle */
    status: {
        type: String,
        enum: ["Open", "Investigating", "Resolved"],
        default: "Open"
    },

    /* Alert timestamp */
    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Alert", alertSchema);