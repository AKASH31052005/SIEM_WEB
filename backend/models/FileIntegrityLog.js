const mongoose = require("mongoose");

const FileIntegritySchema = new mongoose.Schema({
  filePath: String,
  eventType: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  severity: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium"
  }
});

module.exports = mongoose.model("FileIntegrityLog", FileIntegritySchema);