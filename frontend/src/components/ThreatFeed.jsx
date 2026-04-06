import React from "react";

function ThreatFeed({ alerts }) {

  return (
    <div style={{
      background: "#1e293b",
      padding: "15px",
      borderRadius: "10px",
      marginTop: "20px"
    }}>

      <h3>🚨 Threat Feed</h3>

      {alerts.slice(0,10).map(alert => (
        <div key={alert._id} style={{
          borderBottom: "1px solid #444",
          padding: "8px"
        }}>

          <strong>{alert.severity}</strong> - {alert.type}

          <div style={{ fontSize: "12px", color: "#aaa" }}>
            {alert.message}
          </div>

        </div>
      ))}

    </div>
  );
}

export default ThreatFeed;