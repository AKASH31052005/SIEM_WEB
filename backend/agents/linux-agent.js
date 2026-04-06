const { spawn } = require("child_process");
const axios = require("axios");

const BACKEND_URL = "http://localhost:5000/api/agent/log";

console.log("Linux Agent Started...");

const tail = spawn("tail", ["-F", "/var/log/auth.log"]);

tail.stdout.on("data", async (data) => {
    const logLine = data.toString().trim();

    if (!logLine) return;  // prevent empty send

    try {
        await axios.post(BACKEND_URL, {
            source: "linux",
            log: logLine
        }, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        console.log("Sent:", logLine);

    } catch (error) {
        console.error("Send Error:", error.message);
    }
});