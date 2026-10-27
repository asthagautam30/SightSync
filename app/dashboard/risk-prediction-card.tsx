"use client";

import { useState } from "react";

type SensorValues = {
  uv?: number;
  gas?: number;
  light?: number;
  distance?: number;
};

type Props = { sensors: SensorValues | null };

type PredictionResponse = {
  risk: string;
  probabilities?: Record<string, number>;
  development_only?: boolean;
  warning?: string;
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  boxSizing: "border-box",
};

export default function RiskPredictionCard({ sensors }: Props) {
  const [baseline, setBaseline] = useState({
    uv_baseline: "2000",
    gas_baseline: "1239.55",
    light_baseline: "1000",
    distance_baseline: "50",
  });
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = [sensors?.uv, sensors?.gas, sensors?.light, sensors?.distance]
    .every((value) => typeof value === "number" && Number.isFinite(value));

  async function predict() {
    if (!ready || !sensors) {
      setError("Waiting for all four live sensor readings.");
      return;
    }
    const baselineValues = Object.fromEntries(
      Object.entries(baseline).map(([key, value]) => [key, Number(value)])
    ) as Record<keyof typeof baseline, number>;
    if (Object.values(baselineValues).some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Enter valid non-negative baseline values.");
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    try {
      const endpoint =
        process.env.NEXT_PUBLIC_RISK_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uv: sensors.uv,
          gas: sensors.gas,
          light: sensors.light,
          distance: sensors.distance,
          ...baselineValues,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || `Prediction request failed (${response.status})`);
      }
      setResult(payload as PredictionResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. Make sure the Python risk API is running on port 8000.`
          : "Could not get a prediction."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ margin: "22px 0", padding: 22, borderRadius: 18, border: "1px solid #334155", background: "#111c2e", color: "#e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 6px", color: "#67e8f9", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>AI / ML</p>
          <h2 style={{ margin: 0, fontSize: 21 }}>Sensor Risk Prediction</h2>
          <p style={{ margin: "8px 0 0", color: "#a7b6ca", fontSize: 13 }}>Uses the latest live readings and the baseline values below.</p>
        </div>
        <button type="button" onClick={predict} disabled={!ready || busy} style={{ padding: "11px 16px", borderRadius: 10, border: 0, background: !ready || busy ? "#475569" : "#0891b2", color: "white", fontWeight: 700, cursor: !ready || busy ? "not-allowed" : "pointer" }}>
          {busy ? "Predicting..." : "Predict risk"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 18 }}>
        {([
          ["uv_baseline", "UV baseline"],
          ["gas_baseline", "Gas baseline"],
          ["light_baseline", "Light baseline"],
          ["distance_baseline", "Distance baseline"],
        ] as const).map(([key, label]) => (
          <label key={key} style={{ color: "#a7b6ca", fontSize: 12 }}>
            {label}
            <input type="number" min="0" step="any" value={baseline[key]} onChange={(event) => setBaseline((old) => ({ ...old, [key]: event.target.value }))} style={{ ...fieldStyle, marginTop: 6 }} />
          </label>
        ))}
      </div>
      <p style={{ color: "#a7b6ca", fontSize: 12, marginBottom: 0 }}>Current readings: UV {sensors?.uv ?? "—"} · Gas {sensors?.gas ?? "—"} · Light {sensors?.light ?? "—"} · Distance {sensors?.distance ?? "—"}</p>
      {error && <p role="alert" style={{ color: "#fca5a5", marginBottom: 0 }}>{error}</p>}
      {result && (
        <div aria-live="polite" style={{ marginTop: 16, padding: 15, borderRadius: 12, background: "#0f172a" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Predicted risk: {result.risk}</h3>
          {result.probabilities && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {Object.entries(result.probabilities).map(([label, value]) => <div key={label} style={{ color: "#cbd5e1", fontSize: 13 }}>{label}: {(value * 100).toFixed(1)}%</div>)}
          </div>}
          <p style={{ color: "#fcd34d", fontSize: 12, marginBottom: 0 }}>{result.warning || "Development-only model output; not validated for real-world safety use."}</p>
        </div>
      )}
    </section>
  );
}
