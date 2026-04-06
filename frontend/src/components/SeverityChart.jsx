import React from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

function SeverityChart({ alerts = [] }) {

  const severityCounts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0
  };

  (alerts || []).forEach(alert => {
    if (alert?.severity && severityCounts[alert.severity] !== undefined) {
      severityCounts[alert.severity]++;
    }
  });

  const data = {
    labels: ["Critical", "High", "Medium", "Low"],
    datasets: [
      {
        data: [
          severityCounts.Critical,
          severityCounts.High,
          severityCounts.Medium,
          severityCounts.Low
        ],
        backgroundColor: [
          "#ff0000",
          "#ff9900",
          "#ffcc00",
          "#00cc66"
        ]
      }
    ]
  };

  return (
    <div style={{ width: "350px" }}>
      <h3>Alert Severity</h3>
      <Pie data={data} redraw />
    </div>
  );
}

export default SeverityChart;