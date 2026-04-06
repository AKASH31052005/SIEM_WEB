const { generateExplanation } = require("./aiService");
const AIExplanation = require("../models/AIExplanation");

async function handleAIExplanation(alert) {

    try {

        console.log("🧠 Generating AI explanation...");

        const aiText = await generateExplanation(alert);

        const explanationDoc = await AIExplanation.create({
            alertId: alert._id,
            explanation: aiText,
            summary: aiText.substring(0, 200)
        });

        console.log("✅ AI Explanation saved");

        if (global.io) {
            global.io.emit("aiExplanation", explanationDoc);
        }

    } catch (err) {
        console.error("❌ AI Error:", err.message);
    }
}

module.exports = handleAIExplanation;