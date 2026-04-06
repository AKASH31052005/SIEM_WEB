const mongoose = require("mongoose");

const LinuxLogSchema = new mongoose.Schema({
    Timestamp: Date,
    Host: String,
    Process: String,
    Message: String,
    IP: String,
    Status: String
}, { timestamps: true });

module.exports = mongoose.model("LinuxLog", LinuxLogSchema);