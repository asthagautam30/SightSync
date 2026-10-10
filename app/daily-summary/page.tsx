"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/auth-provider";
import {
  getDailySensorSummary,
  type DailySensorSummary,
} from "@/lib/daily-sensor-summary";

const SENSOR_LABELS: Record<string, string> = {
  uv: "UV Sensor",
  gas: "Gas / Smoke Sensor",
  light: "Light Sensor",
  distance: "Distance Sensor",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#07111f",
  color: "#e5eefb",
  padding: "32px 20px",
  fontFamily: "Arial, sans-serif",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
};

const cardStyle: React.CSSProperties = {
  background: "#101e30",
  border: "1px solid #263850",
  borderRadius: "14px",
  padding: "20px",
};

export default function DailySummaryPage() {
  const { user, loading } = useAuth();

  const [selectedDate, setSelectedDate] = useState("");
  const [summaries, setSummaries] = useState<DailySensorSummary[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  // Initialize the date in the browser to avoid hydration mismatches.
  useEffect(() => {
    setSelectedDate(new Date().toLocaleDateString("en-CA"));
  }, []);

  useEffect(() => {
    if (loading || !user || !selectedDate) return;

    let cancelled = false;

    async function loadSummary() {
      setFetching(true);
      setError("");

      try {
        const [year, month, day] = selectedDate.split("-").map(Number);
        const date = new Date(year, month - 1, day);

        const result = await getDailySensorSummary(user!.uid, date);

        if (!cancelled) {
          setSummaries(result);
        }
      } catch (err) {
        console.error("Failed to load daily sensor summary:", err);

        if (!cancelled) {
          setError(
            "Could not load the daily summary. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [loading, user, selectedDate]);

  if (loading) {
    return <main style={pageStyle}>Checking your account...</main>;
  }

  if (!user) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <h1>Daily Sensor Summary</h1>
          <p>Please log in to view your sensor history.</p>
          <Link href="/login" style={{ color: "#67e8f9" }}>
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "18px",
            marginBottom: "30px",
          }}
        >
          <Link href="/dashboard" style={{ color: "#67e8f9" }}>
            Dashboard
          </Link>

          <Link href="/history" style={{ color: "#67e8f9" }}>
            History
          </Link>

          <Link href="/alerts" style={{ color: "#67e8f9" }}>
            Alerts
          </Link>

          <Link href="/thresholds" style={{ color: "#67e8f9" }}>
            Threshold Settings
          </Link>
        </nav>

        <header style={{ marginBottom: "28px" }}>
          <p
            style={{
              color: "#67e8f9",
              fontSize: "12px",
              letterSpacing: "2px",
              fontWeight: "bold",
            }}
          >
            SENSOR ANALYTICS
          </p>

          <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
            Daily Sensor Summary
          </h1>

          <p style={{ color: "#9fb1c8", lineHeight: 1.6 }}>
            Review daily sensor statistics and compare them with
            readings recorded during the previous seven calendar days.
          </p>
        </header>

        <section style={{ ...cardStyle, marginBottom: "24px" }}>
          <label
            htmlFor="summary-date"
            style={{ display: "block", marginBottom: "10px" }}
          >
            Select date
          </label>

          <input
            id="summary-date"
            type="date"
            value={selectedDate}
            max={new Date().toLocaleDateString("en-CA")}
            onChange={(event) => setSelectedDate(event.target.value)}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #38506d",
              background: "#07111f",
              color: "#e5eefb",
              fontSize: "15px",
            }}
          />
        </section>

        {fetching && <p>Loading sensor statistics...</p>}

        {error && (
          <p style={{ color: "#fca5a5" }} role="alert">
            {error}
          </p>
        )}

        {!fetching && !error && summaries.length === 0 && (
          <section style={cardStyle}>
            <h2>No readings found</h2>

            <p style={{ color: "#9fb1c8", lineHeight: 1.6 }}>
              No valid sensor readings were found for this date.
              Choose another date or check whether history recording
              was enabled.
            </p>
          </section>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "18px",
          }}
        >
          {summaries.map((summary) => (
            <section key={summary.sensor} style={cardStyle}>
              <h2 style={{ fontSize: "19px", marginTop: 0 }}>
                {SENSOR_LABELS[summary.sensor]}
              </h2>

              <p style={{ color: "#9fb1c8", fontSize: "13px" }}>
                {summary.date}
              </p>

              <div
                style={{
                  borderBottom: "1px solid #263850",
                  paddingBottom: "14px",
                  marginBottom: "14px",
                }}
              >
                <p
                  style={{
                    color: "#9fb1c8",
                    marginBottom: "6px",
                  }}
                >
                  Daily average
                </p>

                <strong
                  style={{ fontSize: "28px", color: "#67e8f9" }}
                >
                  {summary.average}
                </strong>
              </div>

              <p>
                Minimum: <strong>{summary.minimum}</strong>
              </p>

              <p>
                Maximum: <strong>{summary.maximum}</strong>
              </p>

              <p>
                Valid readings: <strong>{summary.readingCount}</strong>
              </p>

              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  borderRadius: "8px",
                  background: !summary.baselineAvailable
                    ? "#292524"
                    : summary.anomalyDetected
                      ? "#451a1a"
                      : "#123328",
                  border: `1px solid ${
                    !summary.baselineAvailable
                      ? "#78716c"
                      : summary.anomalyDetected
                        ? "#ef4444"
                        : "#22c55e"
                  }`,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontWeight: "bold",
                    color: !summary.baselineAvailable
                      ? "#d6d3d1"
                      : summary.anomalyDetected
                        ? "#fca5a5"
                        : "#86efac",
                  }}
                >
                  {!summary.baselineAvailable
                    ? "Not enough historical data"
                    : summary.anomalyDetected
                      ? "Unusual daily average"
                      : "No unusual daily average detected"}
                </p>

                <p
                  style={{
                    marginBottom: 0,
                    marginTop: "10px",
                    fontSize: "13px",
                    color: "#cbd5e1",
                  }}
                >
                  Historical average:{" "}
                  <strong>
                    {summary.baselineAverage === null
                      ? "Unavailable"
                      : summary.baselineAverage}
                  </strong>
                </p>

                <p
                  style={{
                    marginBottom: 0,
                    fontSize: "13px",
                    color: "#cbd5e1",
                  }}
                >
                  Historical readings:{" "}
                  <strong>{summary.baselineReadingCount}</strong>
                </p>

                <p
                  style={{
                    marginBottom: 0,
                    marginTop: "10px",
                    fontSize: "12px",
                    color: "#94a3b8",
                    lineHeight: 1.5,
                  }}
                >
                  {!summary.baselineAvailable
                    ? "At least five previous readings are required for comparison."
                    : "This is a statistical comparison with previous readings, not a confirmed safety assessment."}
                </p>
              </div>
            </section>
          ))}
        </div>

        <p
          style={{
            color: "#94a3b8",
            fontSize: "12px",
            lineHeight: 1.6,
            marginTop: "28px",
          }}
        >
          Note: Current project readings may be simulated. Statistical
          anomalies are not confirmed health or environmental hazards,
          and the readings are not calibrated real-world safety measurements.
        </p>
      </div>
    </main>
  );
}