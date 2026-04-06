const NormalizedLog = require("../models/NormalizedLog");

async function normalizeAndStore(rawLog) {

  let normalized = {
    timestamp: rawLog.timestamp,
    source_type: "windows", // currently assuming windows
    systemName: rawLog.systemName,
    raw_reference_id: rawLog._id
  };

  // 🔐 Windows Failed Login
  if (rawLog.eventId === 4625) {
    normalized.event_category = "authentication";
    normalized.event_action = "login_attempt";
    normalized.event_outcome = "failure";
    normalized.severity = "medium";
  }

  // 🔐 Windows Successful Login
  if (rawLog.eventId === 4624) {
    normalized.event_category = "authentication";
    normalized.event_action = "login_attempt";
    normalized.event_outcome = "success";
    normalized.severity = "low";
  }

  // Save normalized log
  await NormalizedLog.create(normalized);
}

module.exports = { normalizeAndStore };