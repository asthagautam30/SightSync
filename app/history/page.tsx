
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useAuth } from "../auth-provider";
import { db } from "@/lib/firebase";

type SensorValue = number | null | undefined;

type SensorReading = {
  id: string;
  uv?: SensorValue;
  gas?: SensorValue;
  light?: SensorValue;
  distance?: SensorValue;
  timestamp?: unknown;
};

type RangeOption = "1h" | "24h" | "7d";

type SensorKey = "uv" | "gas" | "light" | "distance";

type ChartReading = SensorReading & {
  chartTime: number;
};

const RANGE_OPTIONS: { label: string; value: RangeOption }[] = [
  { label: "Last hour", value: "1h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
];

const SENSOR_CONFIG: {
  key: SensorKey;
  label: string;
  unit: string;
}[] = [
  { key: "uv", label: "UV Sensor Reading", unit: "" },
  { key: "gas", label: "Gas / Smoke Reading", unit: "" },
  { key: "light", label: "Light Level", unit: " lux" },
  { key: "distance", label: "Distance", unit: " cm" },
];

const colors = {
  background: "#050b14",
  card: "#0b1729",
  cardBorder: "#26364b",
  cyan: "#67e8f9",
  text: "#f1f5f9",
  muted: "#91a4bb",
  grid: "#26364b",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "32px 20px",
  background:
    "radial-gradient(ellipse at top, #142a42 0%, #08111f 46%, #050b14 100%)",
  fontFamily: "Arial, sans-serif",
  color: colors.text,
};

const containerStyle: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "16px",
  marginBottom: "24px",
};

const panelStyle: React.CSSProperties = {
  marginTop: "24px",
  padding: "24px",
  background: colors.card,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.cardBorder,
  borderRadius: "16px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
};

const filterStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const statCardStyle: React.CSSProperties = {
  padding: "18px",
  background: "#102239",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.cardBorder,
  borderRadius: "12px",
  minWidth: 0,
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.cardBorder,
  borderRadius: "9px",
  background: "#102239",
  color: colors.text,
  fontSize: "14px",
  fontWeight: 600,
};

const errorStyle: React.CSSProperties = {
  marginTop: "24px",
  padding: "16px",
  borderRadius: "10px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#7f1d1d",
  background: "#29151b",
  color: "#fecaca",
};

function getDuration(range: RangeOption): number {
  if (range === "1h") return 60 * 60 * 1000;
  if (range === "24h") return 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function formatValue(
  value: number | undefined,
  unit: string
): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${Number(value.toFixed(2))}${unit}`;
}

function isFiniteSensorValue(
  value: unknown
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Converts supported timestamp formats into a valid Date.
 * Invalid or missing timestamps return null.
 */
function getSafeTimestamp(value: unknown): Date | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    try {
      const date: unknown = value.toDate();

      if (
        date instanceof Date &&
        !Number.isNaN(date.getTime())
      ) {
        return date;
      }
    } catch {
      return null;
    }

    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function getValidValues(
  readings: SensorReading[],
  key: SensorKey
): number[] {
  return readings
    .map((reading) => reading[key])
    .filter(isFiniteSensorValue);
}

/**
 * Readings are stored in chronological order.
 * Search backward so "Latest" is the newest record containing
 * a valid numeric value for this particular sensor.
 */
function getLatestValue(
  readings: SensorReading[],
  key: SensorKey
): number | undefined {
  for (let index = readings.length - 1; index >= 0; index--) {
    const value = readings[index][key];

    if (isFiniteSensorValue(value)) {
      return value;
    }
  }

  return undefined;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [range, setRange] = useState<RangeOption>("1h");
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState("");
  const [windowEnd, setWindowEnd] = useState(0);

  useEffect(() => {
  const updateWindow = () => {
    setWindowEnd(Date.now());
  };

  updateWindow();

  const intervalId = window.setInterval(updateWindow, 60_000);

  return () => {
    window.clearInterval(intervalId);
  };
}, [range]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user || windowEnd === 0) {
      return;
    }

    setLoadingHistory(true);
    setError("");

    const windowStart = windowEnd - getDuration(range);

    const historyRef = collection(
      db,
      "users",
      user.uid,
      "sensorHistory"
    );

    const historyQuery = query(
      historyRef,
      where(
        "timestamp",
        ">=",
        Timestamp.fromDate(new Date(windowStart))
      ),
      where(
        "timestamp",
        "<=",
        Timestamp.fromDate(new Date(windowEnd))
      ),
      orderBy("timestamp", "desc"),
      limit(5000)
    );

    const unsubscribe = onSnapshot(
      historyQuery,
      (snapshot) => {
        const savedReadings: SensorReading[] = snapshot.docs.map(
          (document) => ({
            ...document.data(),
            id: document.id,
          }) as SensorReading
        );

        // Firestore returns descending order. Reverse it so
        // charts and statistics process oldest to newest.
        savedReadings.reverse();

        setReadings(savedReadings);
        setLoadingHistory(false);
        setError("");
      },
      (err) => {
        console.error("Failed to load sensor history:", err);

        setError(
          "Could not load sensor history. Please check your connection and try again."
        );

        setLoadingHistory(false);
      }
    );

    return () => unsubscribe();
  }, [user, loading, range, windowEnd]);

  if (loading || !user || windowEnd === 0) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <p style={{ color: colors.muted }}>
            Loading sensor history...
          </p>
        </div>
      </main>
    );
  }

  const windowStart = windowEnd - getDuration(range);

  // Invalid timestamps are safely excluded from chart data.
  const chartData: ChartReading[] = readings.flatMap((reading) => {
    const date = getSafeTimestamp(reading.timestamp);

    if (!date) {
      return [];
    }

    return [
      {
        ...reading,
        chartTime: date.getTime(),
      },
    ];
  });

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div>
            <p
              style={{
                color: colors.cyan,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              Smart Spectacles
            </p>

            <h1 style={{ margin: "0 0 8px", fontSize: "32px" }}>
              📈 Sensor History
            </h1>

            <p
              style={{
                margin: 0,
                color: colors.muted,
                lineHeight: 1.6,
              }}
            >
              Explore your recorded environmental sensor readings.
            </p>
          </div>

          <button
            type="button"
            style={{
              ...buttonStyle,
              background: colors.cyan,
              borderColor: colors.cyan,
              color: "#06121f",
            }}
            onClick={() => router.push("/dashboard")}
          >
            ← Back to Dashboard
          </button>
        </header>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: "20px" }}>
            Time Range
          </h2>

          <div style={filterStyle}>
            {RANGE_OPTIONS.map((option) => {
              const active = range === option.value;

              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setRange(option.value)}
                  aria-pressed={active}
                  style={{
                    ...buttonStyle,
                    background: active ? colors.cyan : "#102239",
                    color: active ? "#06121f" : colors.text,
                    borderColor: active
                      ? colors.cyan
                      : colors.cardBorder,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <p
            style={{
              color: colors.muted,
              fontSize: "13px",
              lineHeight: 1.7,
              marginBottom: 0,
              overflowWrap: "anywhere",
            }}
          >
            Selected window: {new Date(windowStart).toLocaleString()} –{" "}
            {new Date(windowEnd).toLocaleString()}
          </p>

          <p
            style={{
              color: colors.muted,
              fontSize: "13px",
              marginBottom: 0,
            }}
          >
            {readings.length} readings loaded, up to 5,000.
          </p>
        </section>

        {loadingHistory && (
          <section style={panelStyle}>
            <p style={{ color: colors.cyan }}>
              Loading sensor history...
            </p>
          </section>
        )}

        {error && (
          <section role="alert" style={errorStyle}>
            {error}
          </section>
        )}

        {!loadingHistory && !error && readings.length === 0 && (
          <section style={panelStyle}>
            <h2>No readings found</h2>
            <p style={{ color: colors.muted, lineHeight: 1.7 }}>
              There are no saved readings in this time window. Try
              another range or make sure history recording is enabled
              on the dashboard.
            </p>
          </section>
        )}

        {!loadingHistory && !error && readings.length > 0 && (
          <>
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: "20px" }}>
                Sensor Statistics
              </h2>

              <p
                style={{
                  color: colors.muted,
                  fontSize: "13px",
                  marginBottom: "20px",
                }}
              >
                Calculated from actual numeric readings in the selected
                time range. Latest shows the newest valid reading for
                each sensor.
              </p>

              <div style={statsGridStyle}>
                {SENSOR_CONFIG.map((sensor) => {
                  const values = getValidValues(readings, sensor.key);
                  const latest = getLatestValue(readings, sensor.key);

                  const minimum =
                    values.length > 0
                      ? Math.min(...values)
                      : undefined;

                  const maximum =
                    values.length > 0
                      ? Math.max(...values)
                      : undefined;

                  const average =
                    values.length > 0
                      ? values.reduce((sum, value) => sum + value, 0) /
                        values.length
                      : undefined;

                  const stats = [
                    { label: "Latest", value: latest },
                    { label: "Minimum", value: minimum },
                    { label: "Maximum", value: maximum },
                    { label: "Average", value: average },
                  ];

                  return (
                    <div key={sensor.key} style={statCardStyle}>
                      <h3
                        style={{
                          marginTop: 0,
                          fontSize: "16px",
                          lineHeight: 1.5,
                        }}
                      >
                        {sensor.label}
                      </h3>

                      {stats.map((stat) => (
                        <p
                          key={stat.label}
                          style={{
                            margin: "10px 0",
                            color: colors.muted,
                            fontSize: "14px",
                          }}
                        >
                          <strong style={{ color: colors.text }}>
                            {stat.label}:
                          </strong>{" "}
                          <span style={{ color: colors.text }}>
                            {formatValue(stat.value, sensor.unit)}
                          </span>
                        </p>
                      ))}

                      <p
                        style={{
                          marginBottom: 0,
                          marginTop: "14px",
                          fontSize: "12px",
                          color: colors.muted,
                        }}
                      >
                        {values.length} numeric readings
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {SENSOR_CONFIG.map((sensor) => {
              const sensorData = chartData.filter((reading) =>
                isFiniteSensorValue(reading[sensor.key])
              );

              return (
                <section key={sensor.key} style={panelStyle}>
                  <h2
                    style={{
                      marginTop: 0,
                      marginBottom: "20px",
                      fontSize: "20px",
                    }}
                  >
                    {sensor.label}
                  </h2>

                  {sensorData.length === 0 ? (
                    <p style={{ color: colors.muted }}>
                      No numeric readings with valid timestamps are
                      available for this sensor.
                    </p>
                  ) : (
                    <div style={{ width: "100%", height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={sensorData}
                          margin={{
                            top: 10,
                            right: 20,
                            left: 5,
                            bottom: 10,
                          }}
                        >
                          <CartesianGrid
                            stroke={colors.grid}
                            strokeDasharray="3 3"
                          />

                          <XAxis
                            dataKey="chartTime"
                            type="number"
                            scale="time"
                            domain={[windowStart, windowEnd]}
                            allowDataOverflow
                            tick={{
                              fontSize: 11,
                              fill: colors.muted,
                            }}
                            tickLine={false}
                            axisLine={{
                              stroke: colors.cardBorder,
                            }}
                            minTickGap={35}
                            tickFormatter={(value) =>
                              new Date(Number(value)).toLocaleString(
                                [],
                                {
                                  month:
                                    range === "7d"
                                      ? "short"
                                      : undefined,
                                  day:
                                    range === "7d"
                                      ? "numeric"
                                      : undefined,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            }
                          />

                          <YAxis
                            width={65}
                            tick={{
                              fontSize: 12,
                              fill: colors.muted,
                            }}
                            tickLine={false}
                            axisLine={{
                              stroke: colors.cardBorder,
                            }}
                            domain={["auto", "auto"]}
                          />

                          <Tooltip
                            contentStyle={{
                              background: "#0b1729",
                              borderWidth: "1px",
                              borderStyle: "solid",
                              borderColor: colors.cardBorder,
                              borderRadius: "10px",
                              color: colors.text,
                            }}
                            labelStyle={{ color: colors.cyan }}
                            itemStyle={{ color: colors.text }}
                            labelFormatter={(value) =>
                              new Date(Number(value)).toLocaleString()
                            }
                            formatter={(value) => [
                              value ?? "Not available",
                              sensor.label,
                            ]}
                          />

                          <Legend
                            wrapperStyle={{
                              color: colors.text,
                              fontSize: "12px",
                            }}
                          />

                          <Line
                            type="monotone"
                            dataKey={sensor.key}
                            name={sensor.label}
                            stroke={colors.cyan}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{
                              r: 5,
                              fill: colors.cyan,
                              stroke: "#08111f",
                              strokeWidth: 2,
                            }}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
