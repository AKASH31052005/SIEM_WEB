const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Log = require("../models/Log");
const Alert = require("../models/Alert");
const ApplicationLog = require("../models/ApplicationLog");

// 🔹 Register
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await new User({
      username,
      password: hashed
    }).save();

    // Application log
    await ApplicationLog.create({
      event_category: "authentication",
      event_action: "register",
      endpoint: "/api/auth/register",
      method: "POST",
      user: username,
      ip_address: req.ip,
      severity: "low",
      message: "New user registered"
    });

    res.json({ message: "User registered" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// 🔹 Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const systemName = "Web-App";

    const user = await User.findOne({ username });

    if (!user) {
      await logFailedLogin(username, systemName, req);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      await logFailedLogin(username, systemName, req);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id },
      "secretkey",
      { expiresIn: "1h" }
    );

    // ✅ Raw Log (for existing system)
    await new Log({
      systemName,
      logType: "Application",
      message: `User ${username} logged in successfully`,
      severity: "Low"
    }).save();

    // ✅ Structured Application Log
    await ApplicationLog.create({
      event_category: "authentication",
      event_action: "login_success",
      endpoint: "/api/auth/login",
      method: "POST",
      user: username,
      ip_address: req.ip,
      severity: "low",
      message: "User logged in successfully"
    });

    res.json({ token });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// 🔥 Failed Login Logger
async function logFailedLogin(username, systemName, req) {

  // Raw Log (existing system)
  await new Log({
    systemName,
    logType: "Application",
    message: `Failed login attempt for ${username}`,
    severity: "High"
  }).save();

  // Structured Application Log
  await ApplicationLog.create({
    event_category: "authentication",
    event_action: "login_failed",
    endpoint: "/api/auth/login",
    method: "POST",
    user: username,
    ip_address: req.ip,
    severity: "medium",
    message: "Invalid credentials"
  });

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const failedAttempts = await Log.countDocuments({
    systemName,
    message: { $regex: "Failed login attempt" },
    timestamp: { $gte: fiveMinutesAgo }
  });

  if (failedAttempts >= 5) {
    await new Alert({
      type: "Web Brute Force Attack",
      message: `Multiple failed login attempts detected`,
      severity: "Critical",
      systemName
    }).save();
  }
}

module.exports = router;