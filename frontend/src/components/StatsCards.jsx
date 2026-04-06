import React from "react";

function StatsCards({ stats }) {

  return (
    <div style={{ display: "flex", gap: "20px" }}>

      <div>
        <h3>Total Alerts</h3>
        <p>{stats.totalAlerts}</p>
      </div>

      <div>
        <h3>Critical Alerts</h3>
        <p>{stats.criticalAlerts}</p>
      </div>

      <div>
        <h3>High Alerts</h3>
        <p>{stats.highAlerts}</p>
      </div>

      <div>
        <h3>Medium Alerts</h3>
        <p>{stats.mediumAlerts}</p>
      </div>

    </div>
  );
}

export default StatsCards;