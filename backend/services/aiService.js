async function generateExplanation(alert) {

    return `
⚠ ALERT ANALYSIS:

Type: ${alert.type}

This alert indicates suspicious activity.
Severity: ${alert.severity}

Possible causes:
- Unauthorized access
- Network anomaly
- Malicious behavior

Recommended actions:
- Investigate source IP
- Monitor system logs
- Block attacker if needed
`;
}

module.exports = { generateExplanation };