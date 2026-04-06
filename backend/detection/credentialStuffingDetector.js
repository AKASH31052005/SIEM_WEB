let attempts = {};

const THRESHOLD = 10;

function detectCredentialStuffing(log) {

    if (log.event !== "LOGIN_FAILED") return null;

    const ip = log.ip;
    const user = log.username;

    if (!attempts[ip]) {
        attempts[ip] = new Set();
    }

    attempts[ip].add(user);

    if (attempts[ip].size >= THRESHOLD) {

        attempts[ip].clear();

        return {
            type: "CREDENTIAL_STUFFING",
            severity: "HIGH",
            message: `Multiple usernames attempted from IP ${ip}`,
            source: "AUTH"
        };
    }

    return null;
}

module.exports = detectCredentialStuffing;