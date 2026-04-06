import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

function RiskChart({ data }) {

  return (

    <div>

      <h3>System Risk Scores</h3>

      <BarChart width={400} height={250} data={data}>

        <XAxis dataKey="_id" />
        <YAxis />
        <Tooltip />

        <Bar dataKey="riskScore" />

      </BarChart>

    </div>

  );

}

export default RiskChart;