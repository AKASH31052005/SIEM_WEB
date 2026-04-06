function parseLinuxLog(log) {

    return {
        source: "linux",

        username: log.user || log.username || "unknown",

        ip: log.ip || "unknown",

        status: log.status || "unknown",

        processName: log.process || null,

        timestamp: new Date()
    };
}

module.exports = parseLinuxLog;