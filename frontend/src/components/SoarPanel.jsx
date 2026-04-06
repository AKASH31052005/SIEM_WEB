import React from "react";

function SoarPanel({ logs }) {

  if (!logs || logs.length === 0) {
    return (
      <div style={{ background: "#1e293b", padding: "15px", borderRadius: "10px" }}>
        <h3>⚡ SOAR Activity</h3>
        <p>No SOAR actions yet</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#1e293b", padding: "15px", borderRadius: "10px" }}>
      <h3>⚡ SOAR Activity</h3>

      {logs.map(log => (
        <div key={log._id} style={{ padding: "8px" }}>
          🚫 Blocked IP: {log.ip} <br />
          ⚠ {log.alertType}
        </div>
      ))}

    </div>
  );
}

export default SoarPanel;