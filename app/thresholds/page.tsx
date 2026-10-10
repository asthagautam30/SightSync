"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "../auth-provider";
import {
  SENSOR_THRESHOLDS,
  type SensorKey,
} from "@/lib/sensor-thresholds";

type ThresholdMode = "default" | "custom";

type ThresholdValues = Record<SensorKey, number>;

const DEFAULT_VALUES: ThresholdValues = {
  uv: SENSOR_THRESHOLDS.uv.warningAbove ?? 50,
  gas: SENSOR_THRESHOLDS.gas.warningAbove ?? 300,
  light: SENSOR_THRESHOLDS.light.warningAbove ?? 500,
  distance: SENSOR_THRESHOLDS.distance.warningBelow ?? 50,
};

const SENSOR_ORDER: SensorKey[] = [
  "uv",
  "gas",
  "light",
  "distance",
];

export default function ThresholdSettingsPage() {
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<ThresholdMode>("default");
  const [values, setValues] =
    useState<ThresholdValues>(DEFAULT_VALUES);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setPageLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      try {
        const userRef = doc(db, "users", user!.uid);
        const snapshot = await getDoc(userRef);

        if (cancelled) return;

        if (snapshot.exists()) {
          const saved = snapshot.data().thresholdSettings;

          if (saved?.mode === "custom" || saved?.mode === "default") {
            setMode(saved.mode);
          }

          if (saved?.values) {
            const loadedValues = saved.values;

            setValues({
              uv: validValue(loadedValues.uv, DEFAULT_VALUES.uv),
              gas: validValue(loadedValues.gas, DEFAULT_VALUES.gas),
              light: validValue(
                loadedValues.light,
                DEFAULT_VALUES.light
              ),
              distance: validValue(
                loadedValues.distance,
                DEFAULT_VALUES.distance
              ),
            });
          }
        }
      } catch (err) {
        console.error("Failed to load threshold settings:", err);
        if (!cancelled) {
          setError("Unable to load settings. Please refresh the page.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  function validValue(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : fallback;
  }

  function updateValue(sensor: SensorKey, value: string) {
    setStatus("");
    setError("");

    const parsed = Number(value);

    setValues((current) => ({
      ...current,
      [sensor]: value.trim() !== "" && Number.isFinite(parsed)
        ? parsed
        : 0,
    }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setError("Please log in to save your settings.");
      return;
    }

    for (const sensor of SENSOR_ORDER) {
      if (!Number.isFinite(values[sensor]) || values[sensor] <= 0) {
        setError(
          `Enter a valid positive number for ${SENSOR_THRESHOLDS[sensor].label}.`
        );
        return;
      }
    }

    setSaving(true);
    setStatus("");
    setError("");

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          thresholdSettings: {
            mode,
            values,
            updatedAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setStatus("Threshold settings saved successfully.");
    } catch (err) {
      console.error("Failed to save threshold settings:", err);
      setError("Unable to save settings. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || pageLoading) {
    return <main style={pageStyle}>Loading threshold settings...</main>;
  }

  if (!user) {
    return (
      <main style={pageStyle}>
        <section style={containerStyle}>
          <h1>Log in required</h1>
          <p>Please log in to manage your threshold settings.</p>
          <Link href="/login" style={primaryLinkStyle}>
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div>
            <Link href="/dashboard" style={brandStyle}>
              👓 Smart Spectacles
            </Link>
            <p style={subtitleStyle}>PERSONALIZED SENSOR SETTINGS</p>
          </div>

          <Link href="/dashboard" style={secondaryLinkStyle}>
            ← Back to dashboard
          </Link>
        </header>

        <section style={heroStyle}>
          <p style={eyebrowStyle}>YOUR PREFERENCES</p>
          <h1 style={titleStyle}>Threshold Settings</h1>
          <p style={mutedStyle}>
            Choose the threshold values used by your Smart Spectacles
            software. You can use the current defaults or enter your own
            values.
          </p>
        </section>

        <div style={noticeStyle}>
          <strong style={{ color: "#fcd34d" }}>
            Development and test mode
          </strong>
          <p style={mutedStyle}>
            The current defaults are software test values, not calibrated
            real-world safety limits. Custom values are also experimental
            until sensor calibration and appropriate safety limits have
            been established.
          </p>
        </div>

        <form onSubmit={handleSave} style={formStyle}>
          <h2 style={sectionTitleStyle}>Choose your threshold mode</h2>

          <label style={choiceStyle}>
            <input
              type="radio"
              name="thresholdMode"
              value="default"
              checked={mode === "default"}
              onChange={() => {
                setMode("default");
                setStatus("");
                setError("");
              }}
            />

            <span>
              <strong>Use default values</strong>
              <span style={choiceDescriptionStyle}>
                Use the application's current test thresholds.
              </span>
            </span>
          </label>

          <label style={choiceStyle}>
            <input
              type="radio"
              name="thresholdMode"
              value="custom"
              checked={mode === "custom"}
              onChange={() => {
                setMode("custom");
                setStatus("");
                setError("");
              }}
            />

            <span>
              <strong>Set my own values</strong>
              <span style={choiceDescriptionStyle}>
                Enter personal software thresholds for each sensor.
              </span>
            </span>
          </label>

          <div style={dividerStyle} />

          <h2 style={sectionTitleStyle}>Sensor thresholds</h2>

          <p style={mutedStyle}>
            {mode === "default"
              ? "These are the current default test values. Select custom mode to edit them."
              : "Enter a positive threshold value for each sensor."}
          </p>

          <div style={sensorGridStyle}>
            {SENSOR_ORDER.map((sensor) => {
              const threshold = SENSOR_THRESHOLDS[sensor];

              const direction =
                threshold.warningBelow !== undefined
                  ? "Warn below this value"
                  : "Warn above this value";

              return (
                <div key={sensor} style={sensorCardStyle}>
                  <label htmlFor={`threshold-${sensor}`} style={labelStyle}>
                    {threshold.label}
                  </label>

                  <p style={descriptionStyle}>{direction}</p>

                  <div style={inputRowStyle}>
                    <input
                      id={`threshold-${sensor}`}
                      type="number"
                      min="0.01"
                      step="any"
                      value={values[sensor]}
                      disabled={mode === "default"}
                      onChange={(event) =>
                        updateValue(sensor, event.target.value)
                      }
                      style={{
                        ...inputStyle,
                        opacity: mode === "default" ? 0.65 : 1,
                      }}
                    />

                    <span style={unitStyle}>
                      {threshold.unit.trim() || "units"}
                    </span>
                  </div>

                  <p style={descriptionStyle}>
                    Current default: {DEFAULT_VALUES[sensor]}{" "}
                    {threshold.unit.trim() || "units"}
                  </p>

                  <p style={descriptionStyle}>
                    {threshold.description}
                  </p>
                </div>
              );
            })}
          </div>

          {error && (
            <p role="alert" style={errorStyle}>
              {error}
            </p>
          )}

          {status && (
            <p role="status" style={successStyle}>
              {status}
            </p>
          )}

          <button type="submit" disabled={saving} style={buttonStyle}>
            {saving ? "Saving settings..." : "Save threshold settings"}
          </button>

          <p style={footerNoteStyle}>
            Your settings are saved to your signed-in user's Firestore
            document. This page does not yet change the dashboard's
            threshold calculations; we'll connect them in the next step.
          </p>
        </form>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "28px 18px 50px",
  background:
    "radial-gradient(ellipse at top, #142a42 0%, #08111f 46%, #050b14 100%)",
  color: "#f1f5f9",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
  paddingBottom: 22,
  borderBottom: "1px solid #20344b",
};

const brandStyle: React.CSSProperties = {
  color: "#f1f5f9",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 20,
};

const subtitleStyle: React.CSSProperties = {
  color: "#67e8f9",
  fontSize: 10,
  letterSpacing: "1.5px",
};

const heroStyle: React.CSSProperties = {
  padding: "30px 0 22px",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#67e8f9",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "1.8px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "clamp(30px, 5vw, 42px)",
  margin: "10px 0",
};

const mutedStyle: React.CSSProperties = {
  color: "#91a4bb",
  fontSize: 13,
  lineHeight: 1.8,
};

const noticeStyle: React.CSSProperties = {
  padding: 18,
  background: "rgba(120, 80, 10, 0.12)",
  border: "1px solid #665126",
  borderRadius: 13,
  marginBottom: 20,
};

const formStyle: React.CSSProperties = {
  padding: "clamp(18px, 3vw, 28px)",
  background: "rgba(11, 23, 39, 0.92)",
  border: "1px solid #20344b",
  borderRadius: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 19,
  margin: "0 0 16px",
};

const choiceStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: 16,
  marginTop: 10,
  background: "rgba(15, 30, 49, 0.65)",
  border: "1px solid #31465e",
  borderRadius: 11,
  cursor: "pointer",
};

const choiceDescriptionStyle: React.CSSProperties = {
  display: "block",
  color: "#91a4bb",
  fontSize: 12,
  lineHeight: 1.7,
  marginTop: 5,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: "#20344b",
  margin: "25px 0",
};

const sensorGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
  marginTop: 20,
};

const sensorCardStyle: React.CSSProperties = {
  padding: 17,
  background: "linear-gradient(145deg, #102239, #0b1729)",
  border: "1px solid #203a50",
  borderRadius: 12,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#e2eaf5",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.6,
};

const descriptionStyle: React.CSSProperties = {
  color: "#91a4bb",
  fontSize: 11,
  lineHeight: 1.7,
};

const inputRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "12px 10px",
  background: "#07111e",
  color: "#f1f5f9",
  border: "1px solid #31465e",
  borderRadius: 8,
  fontSize: 15,
};

const unitStyle: React.CSSProperties = {
  color: "#91a4bb",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 22,
  padding: 14,
  border: "1px solid #67e8f9",
  borderRadius: 10,
  background: "#67e8f9",
  color: "#07111e",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 15px",
  background: "#67e8f9",
  color: "#07111e",
  borderRadius: 9,
  textDecoration: "none",
  fontWeight: 700,
};

const secondaryLinkStyle: React.CSSProperties = {
  color: "#67e8f9",
  textDecoration: "none",
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  padding: 13,
  border: "1px solid #7f2938",
  borderRadius: 9,
  background: "rgba(127, 29, 29, 0.25)",
  color: "#fecdd3",
  fontSize: 13,
};

const successStyle: React.CSSProperties = {
  padding: 13,
  border: "1px solid #166534",
  borderRadius: 9,
  background: "rgba(22, 101, 52, 0.2)",
  color: "#86efac",
  fontSize: 13,
};

const footerNoteStyle: React.CSSProperties = {
  color: "#71869e",
  fontSize: 12,
  lineHeight: 1.8,
  marginTop: 16,
};