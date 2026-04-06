const RawLog = require("../models/RawLog");
const { normalizeAndStore } = require("../services/normalizationService");

exports.receiveLog = async (req, res) => {
  try {
    const { source_type, raw_data } = req.body;

    const raw = await RawLog.create({
      source_type,
      raw_data
    });

    // 🔥 NORMALIZATION TRIGGER
    await normalizeAndStore(raw);

    res.status(200).json({ message: "Log saved & normalized" });

  } catch (err) {
    console.error("Log Error:", err);
    res.status(500).json({ error: err.message });
  }
};