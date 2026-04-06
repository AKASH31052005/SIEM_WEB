function parseDatabaseLog(log) {

    return {
        source: "database",

        eventType: log.eventType || "query",

        user: log.user || "unknown",

        database: log.database || "unknown",

        query: log.query || "",

        ip: log.ip || "unknown",

        timestamp: new Date()
    };

}

module.exports = parseDatabaseLog;