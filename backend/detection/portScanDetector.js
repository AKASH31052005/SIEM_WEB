let portTracker = {};

const PORT_THRESHOLD = 20;

function detectPortScan(log) {

    if (log.type !== "NETWORK") return null;

    const ip = log.src_ip;
    const port = log.dst_port;

    if (!portTracker[ip]) {
        portTracker[ip] = new Set();
    }

    portTracker[ip].add(port);

    if (portTracker[ip].size >= PORT_THRESHOLD) {

        portTracker[ip].clear();

        return {
            type: "PORT_SCAN",
            severity: "HIGH",
            message: `Port scanning detected from ${ip}`,
            source: "NETWORK"
        };
    }

    return null;
}

module.exports = detectPortScan;