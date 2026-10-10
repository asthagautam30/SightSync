"use client";

import { useState } from "react";
import Link from "next/link";
import {
  checkThreshold,
  SENSOR_THRESHOLDS,
  type SensorKey,
} from "@/lib/sensor-thresholds";

const SENSOR_KEYS: SensorKey[] = [
  "uv",
  "gas",
  "light",
  "distance",
];

export default function ThresholdTestPage() {
  const [sensor, setSensor] = useState<SensorKey>("uv");
  const [reading, setReading] = useState("10");

  const numericReading = reading.trim() === "" ? null : Number(reading);
  const result =
    numericReading === null || !Number.isFinite(numericReading)
      ? null
      : checkThreshold(sensor, numericReading);

  const resultText =
    result === true
      ? "Warning detected"
      : result === false
        ? "Reading is within the configured threshold"
        : "Threshold not configured";

  const resultColor =
    result === true
      ? "#fca5a5"
      : result === false
        ? "#86efac"
        : "#fcd34d";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 18px",
        background:
          "radial-gradient(ellipse at top, #142a42 0%, #08111f 46%, #050b14 100%)",
        color: "#f1f5f9",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Link
          href="/dashboard"
          style={{
            color: "#67e8f9",
            textDecoration: "none",
          }}
        >
          ← Back to dashboard
        </Link>

        <p
          style={{
            color: "#67e8f9",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 2,
            marginTop: 32,
          }}
        >
          DEVELOPMENT TOOL
        </p>

        <h1 style={{ fontSize: 32, marginBottom: 10 }}>
          Sensor threshold test
        </h1>

        <p style={{ color: "#91a4bb", lineHeight: 1.8 }}>
          Test the threshold logic using simulated values. These
          results are for software testing only, not real-world
          safety decisions.
        </p>

        <section style={cardStyle}>
          <label htmlFor="sensor" style={labelStyle}>
            Select sensor
          </label>

          <select
            id="sensor"
            value={sensor}
            onChange={(event) =>
              setSensor(event.target.value as SensorKey)
            }
            style={inputStyle}
          >
            {SENSOR_KEYS.map((key) => (
              <option key={key} value={key}>
                {SENSOR_THRESHOLDS[key].label}
              </option>
            ))}
          </select>

          <label htmlFor="reading" style={labelStyle}>
            Simulated reading
            {SENSOR_THRESHOLDS[sensor].unit}
          </label>

          <input
            id="reading"
            type="number"
            value={reading}
            onChange={(event) => setReading(event.target.value)}
            style={inputStyle}
            placeholder="Enter a number"
          />

          <div
            role="status"
            style={{
              marginTop: 24,
              padding: 18,
              border: `1px solid ${resultColor}`,
              borderRadius: 12,
              background: "#0b1729",
            }}
          >
            <p style={{ color: "#91a4bb", margin: "0 0 8px" }}>
              Detection result
            </p>

            <strong style={{ color: resultColor, fontSize: 20 }}>
              {resultText}
            </strong>
          </div>

          <p
            style={{
              color: "#91a4bb",
              fontSize: 13,
              lineHeight: 1.8,
              marginTop: 18,
            }}
          >
            {SENSOR_THRESHOLDS[sensor].description}
          </p>
        </section>

        <p style={{ color: "#71869e", fontSize: 12 }}>
          No Firebase data is changed by this test page.
        </p>
      </div>
    </main>
  );
}

const cardStyle = {
  marginTop: 24,
  padding: 24,
  border: "1px solid #20344b",
  borderRadius: 16,
  background: "rgba(11, 23, 39, 0.92)",
};

const labelStyle = {
  display: "block",
  marginTop: 18,
  marginBottom: 8,
  color: "#dce8f6",
  fontSize: 13,
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 13,
  border: "1px solid #31465e",
  borderRadius: 9,
  background: "#08111f",
  color: "#f1f5f9",
  fontSize: 14,
};