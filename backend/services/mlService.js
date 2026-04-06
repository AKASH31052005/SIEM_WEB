const axios = require("axios");

async function detectAnomaly(features) {

    try {

        const response = await axios.post(
            "http://localhost:8000/detect",
            { features }
        );

        return response.data;

    } catch (error) {

        console.error("ML Engine Error:", error.message);
        return null;
    }
}

module.exports = detectAnomaly;