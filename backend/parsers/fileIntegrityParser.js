function parseFileIntegrityLog(log) {

    return {
        source: "file_integrity",

        filePath: log.filePath,

        action: log.action, // created, modified, deleted

        hash: log.hash || null,

        user: log.user || "unknown",

        timestamp: new Date()
    };

}

module.exports = parseFileIntegrityLog;