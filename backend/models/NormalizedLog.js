const mongoose = require("mongoose");

const NormalizedLogSchema = new mongoose.Schema({
  schema_version: { type: String, default: "1.0" },

  timestamp: { type: Date, required: true },
  source_type: String,        // windows | linux | web
  systemName: String,

  event_category: String,     // authentication | process | file | network
  event_action: String,       // login_attempt | file_modified
  event_outcome: String,      // success | failure

  severity: String,           // low | medium | high | critical

  raw_reference_id: String
});

module.exports = mongoose.model("NormalizedLog", NormalizedLogSchema);