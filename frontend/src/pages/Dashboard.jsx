import React, { useEffect, useState } from "react";
import axios from "axios";
import io from "socket.io-client";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { SOCKET_URL } from "../api";

const socket = io(SOCKET_URL);

export default function Dashboard() {

  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [aiData, setAIData] = useState(null);
  const [soarLogs, setSoarLogs] = useState([]);

  /* ============================
     LOAD INITIAL DATA
  ============================ */
  useEffect(() => {

    fetchAlerts();
    fetchSOAR();

    socket.on("newAlert", (alert) => {
      setAlerts(prev => [alert, ...prev]);
    });

    socket.on("soarAction", (data) => {
      setSoarLogs(prev => [data, ...prev]);
    });

    socket.on("aiExplanation", (data) => {
      console.log("AI update:", data);
    });

  }, []);

  const fetchAlerts = async () => {
    const res = await axios.get("/api/alerts");
    setAlerts(res.data);
  };

  const fetchSOAR = async () => {
    const res = await axios.get("/api/soar");
    setSoarLogs(res.data);
  };

  /* ============================
     CLICK ALERT → AI
  ============================ */
  const handleAlertClick = async (alert) => {

    setSelectedAlert(alert);

    const res = await axios.get(`/api/ai/${alert._id}`);
    setAIData(res.data);
  };

  /* ============================
     CHART DATA
  ============================ */
  const chartData = [
    { name: "Low", value: alerts.filter(a => a.severity === "Low").length },
    { name: "Medium", value: alerts.filter(a => a.severity === "Medium").length },
    { name: "High", value: alerts.filter(a => a.severity === "High").length },
    { name: "Critical", value: alerts.filter(a => a.severity === "Critical").length }
  ];

  return (
    <div style={{ background: "#0f172a", color: "white", padding: "20px" }}>

      <h1>🛡 SOC Dashboard</h1>

      {/* ================= KPI CARDS ================= */}
      <div style={{ display: "flex", gap: "20px" }}>
        <Card title="Total Alerts" value={alerts.length} />
        <Card title="Critical Alerts" value={alerts.filter(a => a.severity === "Critical").length} />
        <Card title="Blocked IPs" value={soarLogs.length} />
      </div>

      {/* ================= MAIN GRID ================= */}
      <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>

        {/* ALERT TABLE */}
        <div style={{ flex: 2 }}>
          <h3>🚨 Alerts</h3>

          {alerts.map(alert => (
            <div
              key={alert._id}
              onClick={() => handleAlertClick(alert)}
              style={{
                padding: "10px",
                marginBottom: "10px",
                background: "#1e293b",
                cursor: "pointer",
                borderLeft: `5px solid ${getColor(alert.severity)}`
              }}
            >
              <strong>{alert.type}</strong>
              <p>{alert.message}</p>
              <small>{alert.severity}</small>
            </div>
          ))}

        </div>

        {/* AI PANEL */}
        <div style={{ flex: 1 }}>
          <h3>🧠 AI Analysis</h3>

          {aiData ? (
            <>
              <p><b>Summary:</b> {aiData.summary}</p>
              <p>{aiData.explanation}</p>
            </>
          ) : (
            <p>Select alert to view AI explanation</p>
          )}
        </div>
      </div>

      {/* ================= SOAR ================= */}
      <div style={{ marginTop: "20px" }}>
        <h3>🚫 SOAR Actions</h3>

        {soarLogs.map((log, i) => (
          <div key={i} style={{ background: "#1e293b", marginBottom: "10px", padding: "10px" }}>
            Blocked IP: {log.ip} ({log.severity})
          </div>
        ))}
      </div>

      {/* ================= CHART ================= */}
      <div style={{ marginTop: "20px" }}>
        <h3>📊 Alerts by Severity</h3>

        <BarChart width={400} height={250} data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" />
        </BarChart>
      </div>

    </div>
  );
}

/* ================= COMPONENTS ================= */

function Card({ title, value }) {
  return (
    <div style={{
      background: "#1e293b",
      padding: "20px",
      borderRadius: "10px",
      width: "200px"
    }}>
      <h4>{title}</h4>
      <h2>{value}</h2>
    </div>
  );
}

function getColor(severity) {
  switch (severity) {
    case "Critical": return "red";
    case "High": return "orange";
    case "Medium": return "yellow";
    default: return "green";
  }
}
