const mongoose = require("mongoose");

const ApplicationLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Structured classification
  event_category: {
    type: String,
    enum: ["authentication", "api", "error", "security"],
    required: true
  },

  event_action: {
    type: String,
    required: true
  },

  // HTTP context
  endpoint: {
    type: String,
    default: null
  },

  method: {
    type: String,
    default: null
  },

  status_code: {
    type: Number,
    default: null
  },

  // User & Network info
  user: {
    type: String,
    default: "anonymous"
  },

  ip_address: {
    type: String,
    default: null
  },

  // Log severity
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "low"
  },

  message: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model("ApplicationLog", ApplicationLogSchema);