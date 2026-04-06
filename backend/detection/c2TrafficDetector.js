const maliciousDomains = [
    "malicious-c2.com",
    "evil-control.net"
];

function detectC2Traffic(log) {

    if (!log.domain) return null;

    if (maliciousDomains.includes(log.domain)) {

        return {
            type: "MALWARE_C2_TRAFFIC",
            severity: "CRITICAL",
            message: `C2 communication with ${log.domain}`,
            source: "NETWORK"
        };
    }

    return null;
}

module.exports = detectC2Traffic;