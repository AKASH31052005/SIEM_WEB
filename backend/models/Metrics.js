const mongoose = require("mongoose");

const MetricsSchema = new mongoose.Schema({

  cpu: Object,
  mem: Object,

  disk: Array,
  net: Array,
  os: Object,

  timestamp: String

}, {
  timestamps: true
});

module.exports = mongoose.model("Metrics", MetricsSchema);