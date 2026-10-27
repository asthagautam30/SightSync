"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useRouter } from "next/navigation";
import { realtimeDb } from "@/lib/firebase";
import { useAuth } from "../auth-provider";
import { getActiveThresholds, type ThresholdValues } from "@/lib/sensor-thresholds";

type SensorKey = "uv" | "gas" | "light" | "distance";
type AdaptiveSensorResult = {
  adaptiveThreshold?: number;
  effectiveThreshold?: number;
  fixedThreshold?: number;
  baseline?: number;
  learningStatus?: string;
  reading?: number;
  baselineEstablished?: boolean;
  initialSamplesCollected?: number;
  initialSamplesRequired?: number;
  batchSamplesCollected?: number;
  batchSamplesRequired?: number;
  consecutiveShiftBatches?: number;
  shiftBatchesRequired?: number;
  warning?: boolean;
  validatedForRealWorldUse?: boolean;
};
type RiskAssessment = {
  risk?: string;
  riskSource?: string;
  triggeredSensors?: string[];
  recommendations?: string[];
  modelAvailable?: boolean;
  modelPrediction?: string;
  modelReason?: string;
  validatedForRealWorldUse?: boolean;
};
type AnomalyAssessment = {
  status?: string;
  anomaly?: boolean | null;
  score?: number | null;
  message?: string;
  trainingSamples?: number;
  trainingSamplesRequired?: number;
  training?: { trainingStatus?: string; trainingSamples?: number; sampleAccepted?: boolean; modelTrained?: boolean; trainingRows?: number; eligible?: boolean; eligibilityReasons?: string[] };
  validatedForRealWorldUse?: boolean;
};
type AdaptiveFirebaseData = {
  sensors?: Partial<Record<SensorKey, AdaptiveSensorResult>>;
  riskAssessment?: RiskAssessment;
  anomalyAssessment?: AnomalyAssessment;
  updatedAt?: number;
};
type SensorData = Partial<Record<SensorKey, number>> & {
  ai?: { warning?: boolean; viewing?: boolean; viewingTime?: number; object?: string };
};

const sensors: { key: SensorKey; label: string; icon: string }[] = [
  { key: "uv", label: "UV Level", icon: "☀️" },
  { key: "gas", label: "Gas / Smoke", icon: "💨" },
  { key: "light", label: "Light Level", icon: "💡" },
];

const navLinkStyle = {
  color: "#a6b8cc", textDecoration: "none", padding: "10px 13px",
  borderRadius: 9, fontSize: 13, border: "1px solid transparent",
};

const panelStyle = {
  padding: "clamp(18px, 3vw, 25px)", borderRadius: 16,
  border: "1px solid #20344b", background: "rgba(11, 23, 39, 0.88)",
};

const mutedTextStyle = { color: "#91a4bb", fontSize: 13, lineHeight: 1.8, margin: "7px 0" };

export default function AdaptiveLearningPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveFirebaseData | null>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [now, setNow] = useState(0);
  const [activeThresholds, setActiveThresholds] = useState<ThresholdValues>(getActiveThresholds());

  useEffect(() => {
    // Keep the first render deterministic for Next.js prerendering.
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    const adaptiveRef = ref(realtimeDb, "devices/Prachi-spectacles-001/adaptive");
    const currentRef = ref(realtimeDb, "devices/Prachi-spectacles-001/current");
    const stopAdaptive = onValue(adaptiveRef, (snapshot) => {
      setAdaptiveData(snapshot.exists() ? snapshot.val() as AdaptiveFirebaseData : null);
    });
    const stopCurrent = onValue(currentRef, (snapshot) => {
      setSensorData(snapshot.exists() ? snapshot.val() as SensorData : null);
    });
    return () => { stopAdaptive(); stopCurrent(); };
  }, [loading, user]);

  const updatedAt = typeof adaptiveData?.updatedAt === "number" ? adaptiveData.updatedAt : null;
  const isFresh = updatedAt !== null && now - updatedAt >= -3000 && now - updatedAt <= 20000;

  if (loading || !user) {
    return <main style={pageStyle}><p style={mutedTextStyle}>Loading Adaptive Learning…</p></main>;
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ paddingBottom: 22, borderBottom: "1px solid #20344b" }}>
          <Link href="/" style={{ color: "#f1f5f9", textDecoration: "none", fontWeight: 800 }}>SightSync</Link>
          <nav aria-label="Main navigation" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "18px 0" }}>
            <Link href="/dashboard" style={navLinkStyle}>Dashboard</Link>
            <Link href="/history" style={navLinkStyle}>Sensor History</Link>
            <Link href="/adaptive-learning" style={{ ...navLinkStyle, color: "#67e8f9", border: "1px solid #164e63", background: "rgba(8, 47, 59, 0.65)" }}>Adaptive Learning</Link>
            <Link href="/alerts" style={navLinkStyle}>Alert History</Link>
            <Link href="/profile" style={navLinkStyle}>Profile Settings</Link>
            <Link href="/thresholds" style={navLinkStyle}>Alert Settings</Link>
            <Link href="/weekly-report" style={navLinkStyle}>Weekly AI Report</Link>
          </nav>
          <p style={{ color: "#67e8f9", fontSize: 10, fontWeight: 800, letterSpacing: "1.8px" }}>EXPERIMENTAL LEARNING</p>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 44px)", lineHeight: 1.15, margin: "0 0 14px" }}>🧠 Adaptive Learning</h1>
          <p style={mutedTextStyle}>See how adaptive learning tracks environmental sensor patterns. Viewing distance remains an internal input to the visual-comfort calculation.</p>
          <p style={{ ...mutedTextStyle, fontSize: 12 }}>
            Last updated: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "Waiting for first update"}
            {" · "}{isFresh ? "Live adaptive results" : "Stale/unavailable — fixed thresholds only"}
          </p>
        </header>

        {isFresh && adaptiveData?.anomalyAssessment && (
          <section style={{ ...panelStyle, marginTop: 20 }}>
            <h2 style={{ fontSize: 19, margin: "0 0 10px" }}>Isolation Forest Anomaly Detection</h2>
            <p style={metricStyle}>Model status: <strong>{adaptiveData.anomalyAssessment.status ?? "Unavailable"}</strong></p>
            <p style={metricStyle}>Result: <strong>{adaptiveData.anomalyAssessment.anomaly === true ? "Unusual sensor pattern detected" : adaptiveData.anomalyAssessment.anomaly === false ? "No anomaly flagged" : "Not available"}</strong></p>
            {typeof adaptiveData.anomalyAssessment.score === "number" && <p style={metricStyle}>Anomaly score: <strong>{adaptiveData.anomalyAssessment.score}</strong></p>}
            <p style={metricStyle}>{adaptiveData.anomalyAssessment.message ?? "Anomaly detection result unavailable."}</p>
            {adaptiveData.anomalyAssessment.training && (
              <>
                <p style={metricStyle}>Automatic training: <strong>
                  {adaptiveData.anomalyAssessment.training.modelTrained
                    ? `Model trained on ${adaptiveData.anomalyAssessment.training.trainingRows ?? adaptiveData.anomalyAssessment.training.trainingSamples ?? 0} eligible readings`
                    : `${adaptiveData.anomalyAssessment.training.trainingSamples ?? adaptiveData.anomalyAssessment.trainingSamples ?? 0}/100 eligible readings collected`}
                </strong></p>
                {!adaptiveData.anomalyAssessment.training.modelTrained && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "rgba(30, 41, 59, .55)", border: "1px solid #334155" }}>
                    <p style={{ ...metricStyle, marginTop: 0 }}>
                      {adaptiveData.anomalyAssessment.training.eligible
                        ? "Current readings are eligible. Keep the device running to collect training samples."
                        : "Training is paused until readings pass the independent safety checks and all sensor baselines are established."}
                    </p>
                    {(adaptiveData.anomalyAssessment.training.eligibilityReasons ?? []).length > 0 && (
                      <ul style={{ paddingLeft: 20, margin: "6px 0", color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 }}>
                        {adaptiveData.anomalyAssessment.training.eligibilityReasons?.map((reason, index) => <li key={index}>{reason}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
            <p style={{ ...mutedTextStyle, fontSize: 12 }}>An anomaly is not automatically a hazard. If the model is unavailable or untrained, keep using fixed safety checks; this model is not validated for real-world safety use.</p>
          </section>
        )}

        {isFresh && adaptiveData?.riskAssessment && (
          <section style={{ ...panelStyle, marginTop: 20 }}>
            <h2 style={{ fontSize: 19, margin: "0 0 10px" }}>AI Risk & Safety Review</h2>
            <p style={metricStyle}>Assessment: <strong>{adaptiveData.riskAssessment.risk ?? "Unavailable"}</strong></p>
            <p style={metricStyle}>Source: <strong>{adaptiveData.riskAssessment.modelAvailable ? "Random Forest + fixed safety override" : "Fixed-limit fallback (no usable Random Forest model)"}</strong></p>
            {!adaptiveData.riskAssessment.modelAvailable && adaptiveData.riskAssessment.modelReason && (
              <div style={{ margin: "10px 0", padding: 12, borderRadius: 10, background: "rgba(30, 41, 59, .55)", border: "1px solid #334155" }}>
                <p style={{ ...metricStyle, margin: 0 }}>Why the trained model is not active: {adaptiveData.riskAssessment.modelReason}</p>
              </div>
            )}
            {adaptiveData.riskAssessment.modelAvailable && adaptiveData.riskAssessment.modelPrediction && (
              <p style={metricStyle}>Random Forest prediction: <strong>{adaptiveData.riskAssessment.modelPrediction}</strong></p>
            )}
            <p style={metricStyle}>Triggered sensors: <strong>{adaptiveData.riskAssessment.triggeredSensors?.join(", ") || "None detected by configured limits"}</strong></p>
            <ul style={{ paddingLeft: 20, marginTop: 10, color: "#cbd5e1", fontSize: 13, lineHeight: 1.8 }}>
              {(adaptiveData.riskAssessment.recommendations ?? []).map((item, index) => <li key={index}>{item}</li>)}
            </ul>
            <p style={{ ...mutedTextStyle, fontSize: 12 }}>Experimental only. A missing/untrained model falls back to fixed-limit checks; no result certifies real-world safety.</p>
          </section>
        )}

        {!adaptiveData?.sensors ? (
          <section style={{ ...panelStyle, marginTop: 20 }}>
            <p style={mutedTextStyle}>Waiting for adaptive data from Firebase. Make sure the Python adaptive script is running.</p>
          </section>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 20 }}>
            {sensors.map(({ key, label, icon }) => {
              const sensor = adaptiveData.sensors?.[key];
              const fixed = activeThresholds[key];
              const adaptive = sensor?.adaptiveThreshold;
              const effective = isFresh && sensor?.baselineEstablished === true && typeof adaptive === "number"
                ? (key === "uv" || key === "gas" ? Math.min(fixed, adaptive) : Math.max(fixed, adaptive))
                : fixed;
              const status = sensor?.learningStatus === "collecting_baseline" ? "📊 Collecting initial baseline"
                : sensor?.learningStatus === "baseline_established" ? "✅ Initial baseline established"
                : sensor?.learningStatus === "checking_new_normal" ? "🔎 Checking whether change persists"
                : sensor?.learningStatus === "monitoring_stability" ? "👀 Monitoring stability"
                : sensor?.learningStatus === "adapting_gradually" ? "🧠 Adapting gradually"
                : sensor?.learningStatus === "paused_hazard" ? "⚠️ Paused — Potential Hazard"
                : sensor?.learningStatus === "paused_unstable" ? "⏸️ Paused — Unstable readings"
                : sensor?.learningStatus === "paused_anomaly" ? "⏸️ Paused — Unusual reading"
                : sensor?.learningStatus ?? "Waiting for data";
              return (
                <section key={key} style={panelStyle}>
                  <h2 style={{ fontSize: 19, margin: "0 0 14px" }}>{icon} {label}</h2>
                  <p style={metricStyle}>Current reading: <strong>{sensorData?.[key] ?? sensor?.reading ?? "—"}</strong></p>
                  <p style={metricStyle}>Fixed safety threshold: <strong>{fixed}</strong></p>
                  <p style={metricStyle}>Adaptive threshold: <strong>{adaptive ?? "—"}</strong></p>
                  <p style={metricStyle}>Effective threshold: <strong>{effective}</strong></p>
                  <p style={metricStyle}>Baseline: <strong>{sensor?.baseline ?? "—"}</strong></p>
                  <p style={metricStyle}>Baseline progress: <strong>{sensor?.baselineEstablished === true
                    ? "Complete"
                    : `${sensor?.initialSamplesCollected ?? 0}/${sensor?.initialSamplesRequired ?? 60} readings`}</strong></p>
                  <p style={metricStyle}>Batch progress: <strong>{sensor?.batchSamplesCollected ?? 0}/{sensor?.batchSamplesRequired ?? 20}</strong> readings</p>
                  <p style={metricStyle}>Confirmed shift batches: <strong>{sensor?.consecutiveShiftBatches ?? 0}/{sensor?.shiftBatchesRequired ?? 3}</strong></p>
                  <p style={metricStyle}>Learning status: <strong>{status}</strong></p>
                  <p style={metricStyle}>Experimental warning: <strong>{sensor?.baselineEstablished !== true ? "Not active — baseline not validated" : sensor?.warning === true ? "Yes" : sensor?.warning === false ? "No" : "Unknown"}</strong></p>
                </section>
              );
            })}
          </div>
        )}
        <p style={{ marginTop: 16, fontSize: 12, color: "#fbbf24" }}>⚠️ Experimental only. These thresholds have not been validated for real-world safety use. Continue using your existing safety settings.</p>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh", padding: "24px 18px 40px",
  background: "radial-gradient(ellipse at top, #142a42 0%, #08111f 46%, #050b14 100%)",
  color: "#f1f5f9", fontFamily: "Arial, Helvetica, sans-serif",
};
const metricStyle = { margin: "8px 0", color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 };
