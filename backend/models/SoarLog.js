const mongoose = require("mongoose");

const soarLogSchema = new mongoose.Schema({

  action: String,
  ip: String,
  alertType: String,
  severity: String,

  timestamp: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("SoarLog", soarLogSchema);