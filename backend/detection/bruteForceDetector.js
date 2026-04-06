const failedAttempts = {};

const THRESHOLD = 5;
const WINDOW = 5 * 60 * 1000;

function detectBruteForce(log) {

    if (log.status !== "failed") return null;

    const ip = log.ip;

    if (!failedAttempts[ip]) {
        failedAttempts[ip] = [];
    }

    failedAttempts[ip].push(Date.now());

    failedAttempts[ip] = failedAttempts[ip].filter(
        t => Date.now() - t < WINDOW
    );

    if (failedAttempts[ip].length >= THRESHOLD) {

        return {
            type: "BRUTE_FORCE_ATTACK",
            severity: "HIGH",
            message: `Multiple failed logins from IP ${ip}`,
            source: log.source
        };
    }

    return null;
}

module.exports = detectBruteForce;