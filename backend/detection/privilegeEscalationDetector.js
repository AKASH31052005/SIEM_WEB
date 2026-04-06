function detectPrivilegeEscalation(log) {

    if (log.eventId === 4672) {

        return {
            type: "PRIVILEGE_ESCALATION",
            severity: "CRITICAL",
            message: `Privilege escalation detected for user ${log.username}`,
            source: log.source
        };
    }

    return null;
}

module.exports = detectPrivilegeEscalation;