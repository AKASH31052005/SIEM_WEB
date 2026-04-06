const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const FileIntegrityLog = require("./models/FileIntegrityLog");

const monitoredPath = process.env.MONITOR_PATH || "./";

let fileHashes = {};

/* ===============================
   HASH GENERATION
================================= */

function hashFile(filePath) {

  try {

    const fileBuffer = fs.readFileSync(filePath);

    return crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

  } catch (err) {

    return null;

  }

}

/* ===============================
   DIRECTORY SCANNER
================================= */

function scanDirectory(dirPath) {

  let files;

  try {

    files = fs.readdirSync(dirPath);

  } catch (err) {

    return;

  }

  files.forEach(file => {

    const fullPath = path.join(dirPath, file);

    let stats;

    try {

      stats = fs.statSync(fullPath);

    } catch (err) {

      return;

    }

    if (stats.isDirectory()) {

      scanDirectory(fullPath);

    } else {

      try {

        const currentHash = hashFile(fullPath);

        if (!currentHash) return;

        if (!fileHashes[fullPath]) {

          fileHashes[fullPath] = currentHash;

        } else if (fileHashes[fullPath] !== currentHash) {

          FileIntegrityLog.create({
            filePath: fullPath,
            oldHash: fileHashes[fullPath],
            newHash: currentHash,
            action: "MODIFIED",
            timestamp: new Date()
          });

          console.log("⚠️ File Modified:", fullPath);

          fileHashes[fullPath] = currentHash;

        }

      } catch (err) {

        // Ignore system/locked files

      }

    }

  });

}

/* ===============================
   MONITOR START
================================= */

function startFileIntegrityMonitoring() {

  console.log("🛡️ File Integrity Monitoring Started");

  console.log("📂 Monitoring Path:", monitoredPath);

  setInterval(() => {

    try {

      scanDirectory(monitoredPath);

    } catch (err) {

      console.log("Scan Error:", err.message);

    }

  }, 20000);

}

/* ===============================
   AUTO START
================================= */

if (require.main === module) {

  startFileIntegrityMonitoring();

}

/* ===============================
   EXPORT FOR SERVER
================================= */

module.exports = startFileIntegrityMonitoring;