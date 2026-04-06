const maliciousIPs = [
    "185.220.101.1",
    "45.95.147.10"
];

function detectSuspiciousOutbound(log) {

    if (!log.dst_ip) return null;

    if (maliciousIPs.includes(log.dst_ip)) {

        return {
            type: "SUSPICIOUS_OUTBOUND",
            severity: "CRITICAL",
            message: `Connection to malicious IP ${log.dst_ip}`,
            source: "NETWORK"
        };
    }

    return null;
}

module.exports = detectSuspiciousOutbound;