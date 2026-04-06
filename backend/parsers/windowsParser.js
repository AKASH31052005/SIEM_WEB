function parseWindowsLog(log) {

    return {
        source: "windows",

        eventId: log.EventID || log.eventId,

        username: log.AccountName || log.username || "unknown",

        ip: log.IpAddress || log.ip || "unknown",

        status: log.Status || log.status || "unknown",

        processName: log.ProcessName || null,

        timestamp: new Date()
    };
}

module.exports = parseWindowsLog;