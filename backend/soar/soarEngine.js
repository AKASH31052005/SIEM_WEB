async function runSOAR(alert) {

    console.log("⚡ SOAR triggered for:", alert.type);

    switch (alert.type) {

        case "BRUTE_FORCE_ATTACK":
            await blockIP(alert.sourceIP);
            break;

        case "SUSPICIOUS_PROCESS":
            await isolateHost(alert.systemName);
            break;

        case "PRIVILEGE_ESCALATION":
            await disableUser(alert.username);
            break;

        default:
            console.log("No SOAR playbook for this alert");
    }
}


/* ===============================
   SOAR PLAYBOOK ACTIONS
================================ */

async function blockIP(ip) {

    console.log(`🚫 Blocking IP: ${ip}`);

    // Example simulation
    // Real system would integrate firewall
}

async function isolateHost(systemName) {

    console.log(`🛑 Isolating host: ${systemName}`);

}

async function disableUser(username) {

    console.log(`🔒 Disabling user account: ${username}`);

}

module.exports = runSOAR;