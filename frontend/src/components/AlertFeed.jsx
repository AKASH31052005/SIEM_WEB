import React from "react";

function AlertFeed({ alerts }) {

  return (
    <div>

      <h3>Threat Feed</h3>

      <ul>
        {alerts.map((alert, index) => (

          <li key={index}>
            {alert.type} - {alert.severity} - {alert.systemName}
          </li>

        ))}
      </ul>

    </div>
  );
}

export default AlertFeed;