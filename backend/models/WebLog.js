const mongoose = require("mongoose");

const WebLogSchema = new mongoose.Schema({
    ServerType: String,
    IP: String,
    Timestamp: String,
    Method: String,
    URL: String,
    StatusCode: String,
    Size: String,

    // Detection Fields
    Is404: Boolean,
    Is500: Boolean,
    IsSuspicious: Boolean
}, { timestamps: true });

module.exports = mongoose.model("WebLog", WebLogSchema);