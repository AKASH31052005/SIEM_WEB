function parseNetworkLog(log) {

    return {
        source: "network",

        srcIP: log.srcIP || "unknown",

        destIP: log.destIP || "unknown",

        protocol: log.protocol || "unknown",

        port: log.port || null,

        action: log.action || "allowed",

        timestamp: new Date()
    };

}

module.exports = parseNetworkLog;