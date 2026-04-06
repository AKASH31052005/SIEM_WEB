function parseApplicationLog(log) {

    return {
        source: "application",

        level: log.level || "info",

        message: log.message || "",

        service: log.service || "unknown",

        ip: log.ip || null,

        timestamp: new Date()
    };

}

module.exports = parseApplicationLog;