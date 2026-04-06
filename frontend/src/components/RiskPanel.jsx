import React from "react";

function RiskPanel({ alerts }) {

  const critical = alerts.filter(a => a.severity === "Critical").length;
  const high = alerts.filter(a => a.severity === "High").length;

  return (
    <div style={{
      background:"#1e293b",
      padding:"15px",
      borderRadius:"10px",
      marginBottom:"20px"
    }}>
      <h3>System Risk</h3>

      <p>Critical Alerts: {critical}</p>
      <p>High Alerts: {high}</p>

    </div>
  );
}

export default RiskPanel;