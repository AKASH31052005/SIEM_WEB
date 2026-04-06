const mongoose = require("mongoose");

const NetworkLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  srcIP: String,
  destIP: String,
  srcPort: Number,
  destPort: Number,
  protocol: String,
  action: {
    type: String,
    enum: ["ALLOW", "BLOCK"]
  },
  bytesTransferred: Number,
  direction: {
    type: String,
    enum: ["INBOUND", "OUTBOUND"]
  }
});

module.exports = mongoose.model("NetworkLog", NetworkLogSchema);