const mongoose = require("mongoose");

const WindowsLogSchema = new mongoose.Schema({
    LogType: String,

    EventRecordID: {
        type: Number,
        default: null
    },

    EventID: {
        type: Number,
        index: true
    },

    TimeCreated: {
        type: Date,
        default: Date.now
    },

    Level: String,
    MachineName: String,
    Message: String,
    Username: String,
    LogonType: String,

    SourceIP: {
        type: String,
        default: "unknown",
        index: true
    },

    Status: String,
    Category: String

}, {
    timestamps: true   // adds createdAt & updatedAt automatically
});

module.exports = mongoose.model("WindowsLog", WindowsLogSchema);
