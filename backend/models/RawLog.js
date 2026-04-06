// models/RawLog.js

const mongoose = require("mongoose");

const RawLogSchema = new mongoose.Schema({
  source_type: String,
  raw_data: mongoose.Schema.Types.Mixed,
  received_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("RawLog", RawLogSchema);