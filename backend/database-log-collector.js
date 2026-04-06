const mongoose = require("mongoose");
const DatabaseLog = require("./models/DatabaseLog");

/* ===============================
   MONGODB CONNECTION
================================= */


/* ===============================
   DATABASE ACTIVITY MONITOR
================================= */

function startDatabaseMonitoring() {

  console.log("🔥 Database Monitoring Started");

  const db = mongoose.connection;

  // Monitor commands executed in MongoDB
  db.on("commandStarted", async (event) => {

    try {
      const collectionName = event.command[event.commandName] || "unknown";
      
      // Prevent infinite recursion by ignoring databaselogs collection
      if (collectionName === "databaselogs" || collectionName.toLowerCase().includes("databaselog")) {
          return;
      }

      const savedLog = await DatabaseLog.create({
        operationType: event.commandName,
        collection: collectionName,
        documentKey: null,
        timestamp: new Date()
      });

      if (global.io) {
        global.io.emit("newLog", {
          ...savedLog.toObject(),
          logType: "database",
          timestamp: savedLog.timestamp || savedLog.createdAt,
          event_category: "database",
          method: savedLog.operationType,
          message: `Database operation: ${savedLog.operationType} on collection ${savedLog.collection}`
        });
      }

      console.log(`📦 DB Operation: ${event.commandName}`);

    } catch (err) {

      console.error("DB Log Error:", err.message);

    }

  });

}

/* ===============================
   EXPORT
================================= */

module.exports = startDatabaseMonitoring;