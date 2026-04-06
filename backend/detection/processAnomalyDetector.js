const suspiciousProcesses = [
    "mimikatz",
    "powershell.exe",
    "cmd.exe",
    "net user"
];

function detectSuspiciousProcess(log) {

    if (!log.processName) return null;

    const procName = log.processName.toLowerCase();
    if (suspiciousProcesses.some(p => procName.includes(p))) {

        return {
            type: "SUSPICIOUS_PROCESS",
            severity: "HIGH",
            message: `Suspicious process detected: ${log.processName}`,
            source: log.source
        };
    }

    return null;
}

module.exports = detectSuspiciousProcess;