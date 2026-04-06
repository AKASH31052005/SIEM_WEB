const mongoose = require("mongoose");

const databaseLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    severity: String,
    eventType: String,
    operationType: String,
    collectionName: String,
    collection: String, // from event.commandName
    documentKey: mongoose.Schema.Types.Mixed,
    message: String,
    user: String,
    metadata: Object
}, { strict: false });

module.exports = mongoose.model("DatabaseLog", databaseLogSchema);