import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

function AttackTimeline({ alerts = [] }) {

  // Group alerts by minute
  const grouped = {};

  alerts.forEach(alert => {
    const time = new Date(alert.timestamp);

    const key = time.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    grouped[key] = (grouped[key] || 0) + 1;
  });

  // Convert to chart format
  const data = Object.keys(grouped).map(time => ({
    time,
    count: grouped[time]
  }));

  return (
    <div style={{
      background: "#1e293b",
      padding: "15px",
      borderRadius: "10px",
      marginTop: "20px"
    }}>

      <h3>📈 Attack Timeline</h3>

      <LineChart width={600} height={250} data={data}>
        <CartesianGrid stroke="#444" />
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis stroke="#ccc" />
        <Tooltip />

        <Line
          type="monotone"
          dataKey="count"
          stroke="#00ffff"
        />

      </LineChart>

    </div>
  );
}

export default AttackTimeline;