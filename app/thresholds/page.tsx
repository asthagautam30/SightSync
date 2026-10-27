"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
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
  DEFAULT_THRESHOLD_VALUES,
  SENSOR_THRESHOLDS,
  type SensorKey,
  type ThresholdValues,
} from "@/lib/sensor-thresholds";

type ThresholdMode = "default" | "custom";

const DEFAULT_VALUES: ThresholdValues = {
  ...DEFAULT_THRESHOLD_VALUES,
};

const SENSOR_ORDER: SensorKey[] = [
  "uv",
  "gas",
  "light",
  "distance",
];

const SENSOR_NAMES: Record<SensorKey, string> = {
  uv: "UV Rays",
  gas: "Gas Level",
  light: "Light Intensity",
};

const SENSOR_RANGES: Record<
  SensorKey,
  {
    low: string;
    medium: string;
    high: string;
    url: string;
    linkLabel: string;
    description: string;
  }
> = {
  uv: {
    low: "0–1000",
    medium: "1001–3000",
    high: "Above 3000",
    url: "/help/alert-settings/uv",
    linkLabel: "How to set UV limit? ↗",
    description:
      "A warning appears when the UV sensor reading rises above your chosen limit. These are device test readings, not a calibrated UV index.",
  },

  gas: {
    low: "0–1000",
    medium: "1001–2000",
    high: "Above 2000",
    url: "/help/alert-settings/gas",
    linkLabel: "How to set gas limit? ↗",
    description:
      "A warning appears when the gas sensor reading rises above your chosen limit. These readings are not calibrated gas concentrations.",
  },

  light: {
    low: "Below 400",
    medium: "400–800",
    high: "Above 800",
    url: "/help/alert-settings/light",
    linkLabel: "How to set light limit? ↗",
    description:
      "A low-light warning appears when the light sensor reading falls below your chosen limit. These are test readings, not calibrated lux values.",
  },

  distance: {
    low: "Below 15 cm",
    medium: "15–30 cm",
    high: "Above 30 cm",
    url: "/help/alert-settings/distance",
    linkLabel: "How to set distance limit? ↗",
    description:
      "A viewing-distance warning is triggered when an object is closer than your configured distance limit.",
  },
};

function isValidThreshold(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function getSavedValues(savedValues: unknown): ThresholdValues {
  const saved = (savedValues ?? {}) as Partial<ThresholdValues>;

  return {
    uv: isValidThreshold(saved.uv)
      ? saved.uv
      : DEFAULT_VALUES.uv,

    gas: isValidThreshold(saved.gas)
      ? saved.gas
      : DEFAULT_VALUES.gas,

    light: isValidThreshold(saved.light)
      ? saved.light
      : DEFAULT_VALUES.light,

    distance: isValidThreshold(saved.distance)
      ? saved.distance
      : DEFAULT_VALUES.distance,
  };
}

export default function ThresholdSettingsPage() {
  const { user } = useAuth();

  const [mode, setMode] = useState<ThresholdMode>("default");
  const [values, setValues] = useState<ThresholdValues>({
    ...DEFAULT_VALUES,
  });
  const [expanded, setExpanded] = useState<SensorKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const userRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userRef);

        if (cancelled) return;

        if (snapshot.exists()) {
          const settings = snapshot.data().thresholdSettings;

          if (settings?.mode === "custom") {
            setMode("custom");
            setValues(getSavedValues(settings.values));
          } else {
            setMode("default");
            setValues({ ...DEFAULT_VALUES });
          }
        } else {
          setMode("default");
          setValues({ ...DEFAULT_VALUES });
        }
      } catch (err) {
        console.error("Failed to load threshold settings:", err);

        if (!cancelled) {
          setError(
            "Could not load settings. Please refresh the page."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [user]);

  function changeMode(newMode: ThresholdMode) {
    setMode(newMode);
    setExpanded(null);
    setStatus("");
    setError("");

    if (newMode === "default") {
      setValues({ ...DEFAULT_VALUES });
    }
  }

  function updateValue(sensor: SensorKey, input: string) {
    setValues((previous) => ({
      ...previous,
      [sensor]: input === "" ? 0 : Number(input),
    }));

    setStatus("");
    setError("");
  }

  async function handleSave() {
    if (!user) {
      setError("Please log in to save your settings.");
      return;
    }

    setStatus("");
    setError("");

    if (mode === "custom") {
      for (const sensor of SENSOR_ORDER) {
        if (!isValidThreshold(values[sensor])) {
          setError(
            `Enter a valid positive warning limit for ${SENSOR_NAMES[sensor]}.`
          );
          return;
        }
      }
    }

    setSaving(true);

    try {
      const valuesToSave: ThresholdValues =
        mode === "custom"
          ? { ...values }
          : { ...DEFAULT_VALUES };

      await setDoc(
        doc(db, "users", user.uid),
        {
          thresholdSettings: {
            mode,
            values: valuesToSave,
            updatedAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setValues({ ...valuesToSave });

      setStatus(
        mode === "default"
          ? "Default alert limits saved successfully."
          : "Custom alert limits saved successfully."
      );
    } catch (err) {
      console.error("Failed to save thresholds:", err);
      setError("Could not save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <main style={styles.page}>
        <section style={styles.panel}>
          <h1 style={styles.title}>Alert Settings</h1>
          <p>Please log in to manage your thresholds.</p>
          <Link href="/login" style={styles.button}>
            Go to Login
          </Link>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <p style={styles.muted}>Loading settings...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.backLink}>
          ← Back to Dashboard
        </Link>

        <h1 style={styles.title}>Alert Settings</h1>

        <p style={styles.subtitle}>
          Choose the default Wokwi test limits or customize warning
          values for each sensor.
        </p>

        <section style={styles.notice} role="note">
          <strong>Simulation thresholds</strong>
          <p style={styles.noticeText}>
            These values match your current Wokwi test configuration.
            They are not calibrated real-world health or safety limits.
          </p>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.heading}>Settings Mode</h2>

          <div style={styles.modeRow}>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="mode"
                checked={mode === "default"}
                onChange={() => changeMode("default")}
                disabled={saving}
              />
              Default
            </label>

            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="mode"
                checked={mode === "custom"}
                onChange={() => changeMode("custom")}
                disabled={saving}
              />
              Custom
            </label>
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.heading}>Sensor Alert Limits</h2>

          {SENSOR_ORDER.map((sensor) => {
            const range = SENSOR_RANGES[sensor];
            const sensorInfo = SENSOR_THRESHOLDS[sensor];
            const isExpanded = expanded === sensor;

            const displayUnit =
              sensor === "distance"
                ? "cm"
                : sensorInfo.unit;

            const warningDirection =
              sensor === "uv" || sensor === "gas"
                ? "Warn when reading rises above the limit."
                : "Warn when reading falls below the limit.";

            return (
              <article key={sensor} style={styles.sensor}>
                <h3 style={styles.sensorTitle}>
                  {SENSOR_NAMES[sensor]}
                </h3>

                <p style={styles.direction}>{warningDirection}</p>

                {mode === "default" ? (
                  <div style={styles.defaultRow}>
                    <span style={styles.defaultLabel}>
                      Warning Limit
                    </span>

                    <strong style={styles.defaultValue}>
                      {DEFAULT_VALUES[sensor]} {displayUnit}
                    </strong>
                  </div>
                ) : (
                  <>
                    <label
                      style={styles.inputLabel}
                      htmlFor={`threshold-${sensor}`}
                    >
                      Warning Limit
                    </label>

                    <div style={styles.inputRow}>
                      <input
                        id={`threshold-${sensor}`}
                        type="number"
                        min="0.000001"
                        step="any"
                        value={
                          values[sensor] === 0
                            ? ""
                            : values[sensor]
                        }
                        onChange={(event) =>
                          updateValue(sensor, event.target.value)
                        }
                        disabled={saving}
                        aria-label={`${SENSOR_NAMES[sensor]} warning limit`}
                        style={styles.input}
                      />

                      <span style={styles.unit}>{displayUnit}</span>

                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(isExpanded ? null : sensor)
                        }
                        aria-expanded={isExpanded}
                        aria-label={`Toggle ${SENSOR_NAMES[sensor]} suggested ranges`}
                        title="Show suggested ranges"
                        style={styles.expandButton}
                      >
                        {isExpanded ? "⌄" : "^"}
                      </button>
                    </div>

                    <div style={styles.inputFooter}>
                      <span style={styles.defaultHint}>
                        Default: {DEFAULT_VALUES[sensor]} {displayUnit}
                      </span>

                      <Link
                        href={range.url}
                        style={styles.referenceLink}
                      >
                        {range.linkLabel}
                      </Link>
                    </div>

                    <p style={styles.rangeNote}>
                      {range.description}
                    </p>

                    {isExpanded && (
                      <div style={styles.rangeBox}>
                        <div style={styles.rangeRow}>
                          <span>Low</span>
                          <strong>{range.low}</strong>
                        </div>

                        <div style={styles.rangeRow}>
                          <span>Medium</span>
                          <strong>{range.medium}</strong>
                        </div>

                        <div style={styles.rangeRow}>
                          <span>High</span>
                          <strong>{range.high}</strong>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </section>

        {status && (
          <p role="status" style={styles.success}>
            {status}
          </p>
        )}

        {error && (
          <p role="alert" style={styles.error}>
            {error}
          </p>
        )}

        <div style={styles.actions}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              ...styles.button,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>

          <Link href="/dashboard" style={styles.cancelButton}>
            Cancel
          </Link>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b1120",
    color: "#e5e7eb",
    padding: "28px 16px 48px",
    fontFamily: "Arial, Helvetica, sans-serif",
  },

  container: {
    maxWidth: "760px",
    margin: "0 auto",
  },

  panel: {
    background: "#111b2e",
    border: "1px solid #263449",
    borderRadius: "12px",
    padding: "18px",
    marginTop: "18px",
  },

  notice: {
    background: "#17243a",
    border: "1px solid #475569",
    borderRadius: "10px",
    padding: "14px 16px",
    marginTop: "18px",
    color: "#bfdbfe",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  noticeText: {
    color: "#cbd5e1",
    margin: "6px 0 0",
  },

  title: {
    fontSize: "28px",
    margin: "14px 0 8px",
  },

  subtitle: {
    color: "#aab5c5",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  heading: {
    fontSize: "18px",
    margin: "0 0 14px",
  },

  muted: {
    color: "#aab5c5",
  },

  backLink: {
    color: "#93c5fd",
    textDecoration: "none",
    fontSize: "14px",
  },

  modeRow: {
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
  },

  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },

  sensor: {
    padding: "15px 0",
    borderBottom: "1px solid #29374c",
  },

  sensorTitle: {
    fontSize: "18px",
    margin: "0 0 8px",
    color: "#f9fafb",
  },

  direction: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#93c5fd",
    margin: "0 0 12px",
  },

  defaultRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    fontSize: "14px",
  },

  defaultLabel: {
    color: "#aab5c5",
  },

  defaultValue: {
    color: "#bfdbfe",
  },

  inputLabel: {
    display: "block",
    fontSize: "13px",
    marginBottom: "7px",
    color: "#cbd5e1",
  },

  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  input: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 13px",
    background: "#0c1525",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f9fafb",
    fontSize: "15px",
    outline: "none",
  },

  unit: {
    flexShrink: 0,
    fontSize: "12px",
    color: "#cbd5e1",
  },

  expandButton: {
    flexShrink: 0,
    width: "32px",
    height: "34px",
    borderRadius: "7px",
    border: "1px solid #475569",
    background: "#1e293b",
    color: "#93c5fd",
    fontSize: "20px",
    cursor: "pointer",
  },

  inputFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "7px",
  },

  defaultHint: {
    color: "#94a3b8",
    fontSize: "12px",
  },

  referenceLink: {
    color: "#93c5fd",
    fontSize: "12px",
    textDecoration: "underline",
  },

  rangeBox: {
    marginTop: "12px",
    padding: "12px",
    border: "1px solid #29374c",
    borderRadius: "8px",
    background: "#0b1424",
  },

  rangeRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px",
    fontSize: "13px",
  },

  rangeNote: {
    color: "#94a3b8",
    fontSize: "12px",
    lineHeight: 1.6,
    margin: "10px 0 0",
  },

  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },

  button: {
    display: "inline-block",
    padding: "11px 18px",
    borderRadius: "8px",
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },

  cancelButton: {
    padding: "11px 18px",
    borderRadius: "8px",
    border: "1px solid #475569",
    color: "#e5e7eb",
    textDecoration: "none",
    fontSize: "14px",
  },

  success: {
    color: "#86efac",
    fontSize: "14px",
  },

  error: {
    color: "#fca5a5",
    fontSize: "14px",
  },
};