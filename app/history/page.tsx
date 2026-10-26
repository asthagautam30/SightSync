"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  Timestamp,
  where,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { onValue, ref as rtdbRef } from "firebase/database";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { useAuth } from "../auth-provider";
import { db, realtimeDb } from "@/lib/firebase";
import { SENSOR_THRESHOLDS } from "@/lib/sensor-thresholds";

type SensorKey = "uv" | "gas" | "light" | "distance";
type RangeOption = "1h" | "24h" | "7d";
type ThresholdMode = "default" | "custom";

type ThresholdValues = Record<SensorKey, number>;

type CurrentDeviceData = {
  uv?: number;
  gas?: number;
  light?: number;
  distance?: number;
  lastSeen?: number;
  timestamp?: number;
  connectionStatus?: string;
  ai?: {
    object?: string;
    objectDetected?: boolean;
    viewing?: boolean;
    viewingTime?: number;
    warning?: boolean;
  };
};

type VisualComfortRecord = {
  id: string;
  timestamp?: Timestamp;
  object?: string;
  objectDetected?: boolean;
  viewing?: boolean;
  viewingTime?: number | null;
  warning?: boolean;
  distance?: number | null;
};

const DEVICE_ID = "Prachi-spectacles-001";

type SensorReading = {
  id: string;
  uv?: number | null;
  gas?: number | null;
  light?: number | null;
  distance?: number | null;
  timestamp?: Timestamp | null;
};

type ChartPoint = SensorReading & {
  chartTime: number;
};

type SensorPoint = ChartPoint & {
  value: number;
  safeValue: number | null;
  alertValue: number | null;
};

const DEFAULT_VALUES: ThresholdValues = {
  uv: SENSOR_THRESHOLDS.uv.warningAbove ?? 3000,
  gas: SENSOR_THRESHOLDS.gas.warningAbove ?? 2000,
  light: SENSOR_THRESHOLDS.light.warningBelow ?? 800,
  distance: SENSOR_THRESHOLDS.distance.warningBelow ?? 30,
};

const RANGE_OPTIONS: {
  label: string;
  value: RangeOption;
}[] = [
  { label: "Last hour", value: "1h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
];
// UV, gas, light, and distance readings are shown in sensor history charts.
// Visual Comfort data is displayed separately below.
// Display all four sensor readings in the history charts.
const SENSOR_CONFIG: {
  key: SensorKey;
  label: string;
  unit: string;
  redWhen: "above" | "below";
}[] = [
  {
    key: "uv",
    label: "UV Sensor Reading",
    unit: "",
    redWhen: "above",
  },
  {
    key: "gas",
    label: "Smoke",
    unit: "",
    redWhen: "above",
  },
  {
    key: "light",
    label: "Light Level",
    unit: " raw test units",
    redWhen: "below",
  },
  {
    key: "distance",
    label: "Viewing Distance",
    unit: " cm",
    redWhen: "below",
  },
];

const colors = {
  card: "#0b1729",
  cardBorder: "#26364b",
  cyan: "#67e8f9",
  text: "#f1f5f9",
  muted: "#91a4bb",
  grid: "#26364b",
  green: "#22c55e",
  red: "#ef4444",
  pink: "#fb7185",
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
  maxWidth: "1500px",
  margin: "0 auto",
};

const panelStyle: React.CSSProperties = {
  marginTop: "24px",
  padding: "24px",
  background: colors.card,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: "16px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  cursor: "pointer",
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: "9px",
  background: "#102239",
  color: colors.text,
  fontSize: "14px",
  fontWeight: 600,
};

function getDuration(range: RangeOption): number {
  if (range === "1h") return 60 * 60 * 1000;
  if (range === "24h") return 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validThreshold(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : fallback;
}

function formatValue(
  value: number,
  unit: string,
  sensorKey: SensorKey
): string {
  if (sensorKey === "distance") {
    if (value >= 100) {
      return `${Number((value / 100).toFixed(2))} m`;
    }
    return `${Number(value.toFixed(2))} cm`;
  }

  return `${Number(value.toFixed(2))}${unit}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [range, setRange] = useState<RangeOption>("1h");
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState("");
  const [windowEnd, setWindowEnd] = useState(0);
  const [currentDevice, setCurrentDevice] = useState<CurrentDeviceData | null>(null);
  const [visualHistory, setVisualHistory] = useState<VisualComfortRecord[]>([]);
  const [recordingError, setRecordingError] = useState("");
  const lastSavedBucket = useRef<number | null>(null);

  const [thresholdMode, setThresholdMode] =
    useState<ThresholdMode>("default");

  const [thresholds, setThresholds] =
    useState<ThresholdValues>(DEFAULT_VALUES);

  const [loadingThresholds, setLoadingThresholds] =
    useState(true);

  const [selectedExtremum, setSelectedExtremum] = useState<{
    sensorKey: SensorKey;
    type: "Max" | "Min";
    point: SensorPoint;
  } | null>(null);

  // Keep the selected time window moving so newly saved readings appear live.
  useEffect(() => {
    setWindowEnd(Date.now());
    const timer = window.setInterval(() => setWindowEnd(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [range]);

  // Redirect users who are not signed in.
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Load the signed-in user's warning-limit settings from Firestore.
  useEffect(() => {
    if (loading) return;

    if (!user) {
      setThresholdMode("default");
      setThresholds(DEFAULT_VALUES);
      setLoadingThresholds(false);
      return;
    }

    let cancelled = false;

    async function loadThresholdSettings() {
      setLoadingThresholds(true);

      try {
        const userRef = doc(db, "users", user!.uid);
        const snapshot = await getDoc(userRef);

        if (cancelled) return;

        const saved = snapshot.exists()
          ? snapshot.data().thresholdSettings
          : null;

        if (saved?.mode === "custom" && saved.values) {
          const values = saved.values;

          setThresholdMode("custom");

          setThresholds({
            uv: validThreshold(values.uv, DEFAULT_VALUES.uv),
            gas: validThreshold(values.gas, DEFAULT_VALUES.gas),
            light: validThreshold(values.light, DEFAULT_VALUES.light),
            distance: validThreshold(
              values.distance,
              DEFAULT_VALUES.distance
            ),
          });
        } else {
          setThresholdMode("default");
          setThresholds(DEFAULT_VALUES);
        }
      } catch (err) {
        console.error(
          "Failed to load history warning-limit settings:",
          err
        );

        if (!cancelled) {
          setThresholdMode("default");
          setThresholds(DEFAULT_VALUES);
        }
      } finally {
        if (!cancelled) {
          setLoadingThresholds(false);
        }
      }
    }

    void loadThresholdSettings();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  // Read the device's live RTDB payload and persist a timestamped snapshot
  // for the signed-in user every 10 seconds. Stable document IDs prevent
  // duplicate documents from repeated RTDB updates in the same time bucket.
  useEffect(() => {
    if (loading || !user) return;

    const currentRef = rtdbRef(realtimeDb, `devices/${DEVICE_ID}/current`);
    const unsubscribe = onValue(
      currentRef,
      (snapshot) => {
        const data = snapshot.val() as CurrentDeviceData | null;
        if (!data) return;
        setCurrentDevice(data);

        const bucket = Math.floor(Date.now() / 10_000);
        if (lastSavedBucket.current === bucket) return;
        lastSavedBucket.current = bucket;
        const timestamp = Timestamp.fromMillis(bucket * 10_000);

        const sensorValues = {
          uv: isValidNumber(data.uv) ? data.uv : null,
          gas: isValidNumber(data.gas) ? data.gas : null,
          light: isValidNumber(data.light) ? data.light : null,
          distance: isValidNumber(data.distance) ? data.distance : null,
        };

        const sensorRecordRef = doc(
          db,
          "users",
          user.uid,
          "sensorHistory",
          `${DEVICE_ID}_${bucket}`
        );

        void setDoc(sensorRecordRef, {
          ...sensorValues,
          deviceId: DEVICE_ID,
          timestamp,
          source: "realtime-database-current",
        }, { merge: true }).catch((err) => {
          console.error("Failed to save sensor history:", err);
          setRecordingError("Sensor readings could not be saved to Firestore. Check Firestore rules.");
        });

        if (data.ai) {
          const aiRecordRef = doc(
            db,
            "users",
            user.uid,
            "visualComfortHistory",
            `${DEVICE_ID}_${bucket}`
          );
          void setDoc(aiRecordRef, {
            deviceId: DEVICE_ID,
            timestamp,
            object: typeof data.ai.object === "string" ? data.ai.object : "",
            objectDetected: Boolean(data.ai.objectDetected),
            viewing: Boolean(data.ai.viewing),
            viewingTime: isValidNumber(data.ai.viewingTime) ? data.ai.viewingTime : null,
            warning: Boolean(data.ai.warning),
            distance: isValidNumber(data.distance) ? data.distance : null,
          }, { merge: true }).catch((err) => {
            console.error("Failed to save Visual Comfort history:", err);
            setRecordingError("Visual Comfort records could not be saved. Check Firestore rules.");
          });
        }
      },
      (err) => {
        console.error("Failed to read live device data:", err);
        setRecordingError("Could not read live device data. Check Realtime Database rules and connection.");
      }
    );

    return () => unsubscribe();
  }, [loading, user]);

  // Subscribe to this user's saved Visual Comfort snapshots.
  useEffect(() => {
    if (loading || !user) return;
    const visualRef = collection(db, "users", user.uid, "visualComfortHistory");
    const visualQuery = query(visualRef, orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(
      visualQuery,
      (snapshot) => {
        setVisualHistory(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as VisualComfortRecord[]);
      },
      (err) => {
        console.error("Failed to load Visual Comfort history:", err);
        setRecordingError("Could not load saved Visual Comfort records. Check Firestore rules.");
      }
    );
    return () => unsubscribe();
  }, [loading, user]);

  // Subscribe to this user's sensor history.
  useEffect(() => {
    if (loading || !user || windowEnd === 0) return;

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
  where("deviceId", "==", DEVICE_ID),
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
        const savedReadings = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as SensorReading[];

        savedReadings.reverse();
        setReadings(savedReadings);
        setLoadingHistory(false);
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

  const chartData: ChartPoint[] = readings
    .filter(
      (reading) =>
        reading.timestamp &&
        typeof reading.timestamp.toDate === "function"
    )
    .map((reading) => ({
      ...reading,
      chartTime: reading.timestamp!.toDate().getTime(),
    }));

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        {/* EXISTING HEADER - UNCHANGED */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
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

            <p style={{ margin: 0, color: colors.muted }}>
              Explore your recorded environmental sensor readings.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button
              type="button"
              style={{
                ...buttonStyle,
                background: colors.cyan,
                borderColor: colors.cyan,
                color: "#06121f",
              }}
              onClick={() => router.push("/thresholds")}
            >
              ⚙ Warning Limit Settings
            </button>

            <button
              type="button"
              style={buttonStyle}
              onClick={() => router.push("/dashboard")}
            >
              ← Back to Dashboard
            </button>
          </div>
        </header>

        {/* Live Visual Comfort dashboard; values are read from Firebase, not demo data. */}
        <section style={{ ...panelStyle, marginTop: 0, padding: "clamp(16px, 2.5vw, 24px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "22px" }}>◎ Visual Comfort</h2>
              <p style={{ margin: "6px 0 0", color: colors.muted, fontSize: "13px" }}>
                Live AI viewing status and saved timestamped records.
              </p>
            </div>
            <span style={{ padding: "8px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
              color: currentDevice?.connectionStatus === "connected" ? "#86efac" : "#fca5a5",
              background: currentDevice?.connectionStatus === "connected" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
              border: `1px solid ${currentDevice?.connectionStatus === "connected" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}` }}>
              {currentDevice?.connectionStatus === "connected" ? "● DEVICE CONNECTED" : "● WAITING FOR DEVICE"}
            </span>
          </div>

          {recordingError && <p role="alert" style={{ color: "#fecaca", background: "#29151b", border: "1px solid #7f1d1d", padding: "10px 12px", borderRadius: "10px" }}>{recordingError}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: "12px" }}>
            <div style={{ padding: "16px", borderRadius: "12px", background: "#102239", border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ margin: "0 0 8px", color: colors.muted, fontSize: "12px" }}>Detected Object</p>
              <strong style={{ fontSize: "20px", textTransform: "capitalize" }}>{currentDevice?.ai?.objectDetected ? currentDevice.ai.object || "Detected" : "None"}</strong>
            </div>
            <div style={{ padding: "16px", borderRadius: "12px", background: "#102239", border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ margin: "0 0 8px", color: colors.muted, fontSize: "12px" }}>Viewing Distance</p>
              <strong style={{ fontSize: "20px" }}>{isValidNumber(currentDevice?.distance) ? `${currentDevice!.distance!.toFixed(1)} cm` : "N/A"}</strong>
            </div>
            <div style={{ padding: "16px", borderRadius: "12px", background: "#102239", border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ margin: "0 0 8px", color: colors.muted, fontSize: "12px" }}>AI Viewing Counter</p>
              <strong style={{ fontSize: "20px" }}>{isValidNumber(currentDevice?.ai?.viewingTime) ? `${Math.floor(currentDevice!.ai!.viewingTime!)} sec` : "N/A"}</strong>
            </div>
            <div style={{ padding: "16px", borderRadius: "12px", background: currentDevice?.ai?.warning ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.10)", border: `1px solid ${currentDevice?.ai?.warning ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.35)"}` }}>
              <p style={{ margin: "0 0 8px", color: colors.muted, fontSize: "12px" }}>Visual Comfort Status</p>
              <strong style={{ fontSize: "18px", color: currentDevice?.ai?.warning ? "#fca5a5" : "#86efac" }}>
                {currentDevice?.ai?.warning ? "⚠ Warning" : currentDevice?.ai?.viewing ? "✓ Viewing normally" : "Waiting / Not viewing"}
              </strong>
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
            <h3 style={{ fontSize: "16px", margin: "0 0 10px" }}>Saved Visual Comfort Records</h3>
            {visualHistory.length === 0 ? (
              <p style={{ color: colors.muted, lineHeight: 1.7, marginBottom: 0 }}>No saved AI records yet. Keep the Wokwi/ESP32 simulation and Python AI running while this page is open to begin recording.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "620px", fontSize: "13px" }}>
                  <thead><tr style={{ color: colors.muted, textAlign: "left", borderBottom: `1px solid ${colors.cardBorder}` }}>
                    <th style={{ padding: "10px 8px" }}>Date &amp; time</th><th style={{ padding: "10px 8px" }}>Object</th><th style={{ padding: "10px 8px" }}>Viewing</th><th style={{ padding: "10px 8px" }}>Counter</th><th style={{ padding: "10px 8px" }}>Status</th>
                  </tr></thead>
                  <tbody>{visualHistory.map((record) => <tr key={record.id} style={{ borderBottom: `1px solid ${colors.cardBorder}` }}>
                    <td style={{ padding: "11px 8px", whiteSpace: "nowrap" }}>{record.timestamp?.toDate ? record.timestamp.toDate().toLocaleString("en-IN") : "—"}</td>
                    <td style={{ padding: "11px 8px", textTransform: "capitalize" }}>{record.objectDetected ? record.object || "Detected" : "None"}</td>
                    <td style={{ padding: "11px 8px" }}>{record.viewing ? "Yes" : "No"}</td>
                    <td style={{ padding: "11px 8px" }}>{isValidNumber(record.viewingTime) ? `${Math.floor(record.viewingTime)} sec` : "—"}</td>
                    <td style={{ padding: "11px 8px", color: record.warning ? "#fca5a5" : "#86efac", fontWeight: 700 }}>{record.warning ? "Warning" : "Normal"}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
            <p style={{ margin: "10px 0 0", color: colors.muted, fontSize: "11px", lineHeight: 1.6 }}>
              Records are saved as 10-second snapshots while this page is open. The AI viewing counter is the Python script&apos;s current 60-second-window value, not a daily total.
            </p>
          </div>
        </section>

        {/* EXISTING TIME RANGE - UNCHANGED */}
        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: "20px" }}>
            Time Range
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {RANGE_OPTIONS.map((option) => {
              const active = range === option.value;

              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setRange(option.value)}
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

          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: "12px",
              background: "#102239",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: "16px" }}>
              📅 Selected Time Period
            </h3>

            <p style={{ margin: "8px 0" }}>
              <strong>From: </strong>
              {new Date(windowStart).toLocaleString("en-IN")}
            </p>

            <p style={{ margin: "8px 0" }}>
              <strong>To: </strong>
              {new Date(windowEnd).toLocaleString("en-IN")}
            </p>

            <p style={{ color: colors.cyan, fontSize: "13px" }}>
              Showing data for{" "}
              {range === "1h"
                ? "the last hour"
                : range === "24h"
                  ? "the last 24 hours"
                  : "the last 7 days"}
            </p>
          </div>

          <p style={{ color: colors.muted, fontSize: "13px" }}>
            Warning Limit mode:{" "}
            <strong style={{ color: colors.cyan }}>
              {loadingThresholds
                ? "Loading..."
                : thresholdMode === "custom"
                  ? "Custom"
                  : "Default"}
            </strong>
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
          <section
            role="alert"
            style={{
              ...panelStyle,
              borderColor: "#7f1d1d",
              background: "#29151b",
              color: "#fecaca",
            }}
          >
            {error}
          </section>
        )}

        {!loadingHistory && !error && readings.length === 0 && (
          <section style={panelStyle}>
            <h2>No readings found</h2>
            <p style={{ color: colors.muted, lineHeight: 1.7 }}>
              No saved readings were found in this time range.
              Try another range or check that history recording
              is enabled.
            </p>
          </section>
        )}

        {/* EXISTING UV, SMOKE AND LIGHT GRAPHS - SAME LOGIC */}
        {!loadingHistory &&
          !error &&
          readings.length > 0 &&
          SENSOR_CONFIG.map((sensor) => {
            const activeThreshold = thresholds[sensor.key];

            const sensorData: SensorPoint[] = chartData
              .filter((reading) =>
                isValidNumber(reading[sensor.key])
              )
              .map((reading) => {
                const value = reading[sensor.key] as number;

                const isAlert =
                  sensor.redWhen === "above"
                    ? value > activeThreshold
                    : value < activeThreshold;

                return {
                  ...reading,
                  value,
                  safeValue: isAlert ? null : value,
                  alertValue: isAlert ? value : null,
                };
              });

            let maxPoint: SensorPoint | null = null;
            let minPoint: SensorPoint | null = null;

            for (const point of sensorData) {
              if (
                maxPoint === null ||
                point.value > maxPoint.value
              ) {
                maxPoint = point;
              }

              if (
                minPoint === null ||
                point.value < minPoint.value
              ) {
                minPoint = point;
              }
            }

            return (
              <section key={sensor.key} style={panelStyle}>
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: "18px",
                    fontSize: "20px",
                  }}
                >
                  {sensor.label}
                </h2>

                {sensorData.length === 0 ? (
                  <p style={{ color: colors.muted }}>
                    No numeric readings available for this sensor.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "18px",
                        marginBottom: "18px",
                        fontSize: "13px",
                      }}
                    >
                      <span style={{ color: colors.pink }}>
                        ● Maximum
                      </span>
                      <span style={{ color: colors.green }}>
                        ● Minimum
                      </span>
                      <span style={{ color: colors.cyan }}>
                        ╌╌ Warning Limit
                      </span>
                      <span style={{ color: colors.muted }}>
                        Warning Limit:{" "}
                        {formatValue(
                          activeThreshold,
                          sensor.unit,
                          sensor.key
                        )}
                      </span>
                    </div>

                    <div style={{ width: "100%", height: 380 }}>
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >
                        <LineChart
                          data={sensorData}
                          margin={{
                            top: 30,
                            right: 24,
                            left: 10,
                            bottom: 12,
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
                                "en-IN",
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
  width={75}
  type="number"
  domain={
  
    sensor.key === "gas"
      ? [0, 4095]
      : sensor.key === "uv"
      ? [0, 20480]
      : sensor.key === "light"
      ? [0, 100000]
      : ["dataMin", "dataMax"]
  }
  ticks={
    sensor.key === "gas"
      ? [0, 1024, 2048, 3072, 4095]
      : sensor.key === "uv"
      ? [0, 5120, 10240, 15360, 20480]
      : sensor.key === "light"
      ? [0, 25000, 50000, 75000, 100000]
      : undefined
  }
  allowDataOverflow={
    sensor.key === "gas" ||
    sensor.key === "uv" ||
    sensor.key === "light"
  }
  tick={{
    fontSize: 12,
    fill: colors.muted,
  }}
  tickLine={false}
  axisLine={{
    stroke: colors.cardBorder,
  }}
/>

                          <Tooltip
                            contentStyle={{
                              background: "#0b1729",
                              border: `1px solid ${colors.cardBorder}`,
                              borderRadius: "10px",
                              color: colors.text,
                            }}
                            labelStyle={{ color: colors.cyan }}
                            itemStyle={{ color: colors.text }}
                            labelFormatter={(value) =>
                              new Date(
                                Number(value)
                              ).toLocaleString()
                            }
                            formatter={(value) => [
                              value == null
                                ? "Not available"
                                : formatValue(
                                    Number(value),
                                    sensor.unit,
                                    sensor.key
                                  ),
                              sensor.label,
                            ]}
                          />

                          <Legend
                            wrapperStyle={{
                              color: colors.text,
                              fontSize: "12px",
                            }}
                          />

                          <ReferenceLine
                            y={activeThreshold}
                            stroke={colors.cyan}
                            strokeDasharray="6 4"
                            strokeWidth={2}
                            label={{
                              value: `Warning Limit: ${formatValue(
                                activeThreshold,
                                sensor.unit,
                                sensor.key
                              )}`,
                              fill: colors.cyan,
                              position: "insideTopRight",
                              fontSize: 12,
                            }}
                          />

                          <Line
                            type="monotone"
                            dataKey="safeValue"
                            name="Safe Reading"
                            stroke={colors.green}
                            strokeWidth={2}
                            dot={false}
                            activeDot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                          />

                          <Line
                            type="monotone"
                            dataKey="alertValue"
                            name="Alert Reading"
                            stroke={colors.red}
                            strokeWidth={2}
                            dot={false}
                            activeDot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                          />

                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="none"
                            dot={(props: { payload?: { id?: string } }) => {
                              const isMax =
                                maxPoint !== null &&
                                props.payload.id === maxPoint.id;

                              const isMin =
                                minPoint !== null &&
                                props.payload.id === minPoint.id;

                              if (!isMax && !isMin) return null;

                              const point = isMax
                                ? maxPoint!
                                : minPoint!;

                              const type: "Max" | "Min" = isMax
                                ? "Max"
                                : "Min";

                              return (
                                <circle
                                  key={`${type}-${props.payload.id}`}
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={6}
                                  fill={
                                    isMax ? colors.pink : colors.green
                                  }
                                  stroke="#ffffff"
                                  strokeWidth={1.5}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => {
                                    setSelectedExtremum({
                                      sensorKey: sensor.key,
                                      type,
                                      point,
                                    });
                                  }}
                                />
                              );
                            }}
                            activeDot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {selectedExtremum &&
                      selectedExtremum.sensorKey === sensor.key && (
                        <p
                          style={{
                            color:
                              selectedExtremum.type === "Max"
                                ? colors.red
                                : colors.green,
                            fontSize: "20px",
                            fontWeight: "bold",
                            marginTop: "14px",
                          }}
                        >
                          {selectedExtremum.type}:{" "}
                          {formatValue(
                            selectedExtremum.point.value,
                            sensor.unit,
                            sensor.key
                          )}
                        </p>
                      )}
                  </>
                )}
              </section>
            );
          })}


      </div>
    </main>
  );
}