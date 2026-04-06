function parseWebLog(log) {

    return {
        source: "web",

        ip: log.ip || "unknown",

        method: log.method || "GET",

        endpoint: log.endpoint || "/",

        statusCode: log.statusCode || 200,

        userAgent: log.userAgent || "",

        timestamp: new Date()
    };
}

module.exports = parseWebLog;