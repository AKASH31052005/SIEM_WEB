const RiskScore = require("../models/RiskScore");

const riskWeights = {

    ML_ANOMALY: 20,
    UEBA_ANOMALY: 25,
    NETWORK_AI_ALERT: 30,
    THREAT_INTEL_IP: 40,
    THREAT_INTEL_API: 40

};

function calculateLevel(score) {

    if (score >= 80) return "Critical";
    if (score >= 50) return "High";
    if (score >= 25) return "Medium";
    return "Low";

}

async function updateRisk(host, alertType) {

    try {

        const weight = riskWeights[alertType] || 10;

        let record = await RiskScore.findOne({ host });

        if (!record) {

            record = new RiskScore({
                host,
                score: weight
            });

        } else {

            record.score += weight;

        }

        record.level = calculateLevel(record.score);
        record.updatedAt = new Date();

        await record.save();

        console.log("⚠ Risk Updated:", host, record.score, record.level);

    } catch (err) {

        console.error("Risk Engine Error:", err.message);

    }

}

module.exports = updateRisk;