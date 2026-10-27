"use client";

import { useEffect, useMemo, useState } from "react";
import type { SafetyPrecaution, SafetyProfile } from "@/lib/safety-precautions";

type Tip = { sensor: string; tip: string };
type ApiResult = { tips?: Tip[]; source?: string; note?: string };

const muted = { color: "#91a4bb", fontSize: 13, lineHeight: 1.7, margin: "7px 0" };

export default function AiPersonalizedSafety({
  precautions,
  profile,
}: {
  precautions: SafetyPrecaution[];
  profile: SafetyProfile | null;
}) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [source, setSource] = useState("loading");
  const [note, setNote] = useState("");
  const requestBody = useMemo(() => JSON.stringify({
    precautions: precautions.map((p) => ({
      sensor: p.sensor,
      title: p.title,
      message: p.message,
      action: p.action,
      severity: p.severity,
    })),
    profile: profile ? {
      screenTime: profile.screenTime,
      outdoorTime: profile.outdoorTime,
      environment: profile.environment,
      warningSensitivity: profile.warningSensitivity,
    } : null,
  }), [precautions, profile]);

  useEffect(() => {
    let cancelled = false;
    const active = JSON.parse(requestBody) as { precautions: unknown[] };
    if (!active.precautions.length) {
      setTips([]);
      setSource("none");
      setNote("");
      return;
    }
    setSource("loading");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12_000);
    fetch("/api/personalized-safety-guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Personalized guidance request failed");
      return response.json() as Promise<ApiResult>;
    }).then((result) => {
      if (cancelled) return;
      setTips(Array.isArray(result.tips) ? result.tips : []);
      setSource(result.source ?? "safe_fallback");
      setNote(result.note ?? "");
    }).catch(() => {
      if (cancelled) return;
      setTips([]);
      setSource("unavailable");
      setNote("AI personalization is temporarily unavailable. The fixed safety actions above still apply.");
    }).finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [requestBody]);

  const tipBySensor = new Map(tips.map((tip) => [tip.sensor, tip.tip]));
  const isAi = source === "gemini_ai" || source === "mixed_ai_and_safe_fallback";

  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ color: "#a5f3fc", fontSize: 14, margin: "0 0 6px" }}>
        {isAi ? "✨ AI-personalized safety tip" : source === "loading" ? "✨ Preparing personalized safety tips…" : "Safety tip"}
      </h4>
      {precautions.map((precaution) => {
        const tip = tipBySensor.get(precaution.sensor) ?? precaution.personalNote ?? precaution.action;
        return (
          <p key={precaution.sensor} style={{ margin: "7px 0", lineHeight: 1.6, color: "#a5f3fc" }}>
            <strong>{precaution.title}: </strong>{tip}
          </p>
        );
      })}
      <p style={{ ...muted, fontSize: 11 }}>
        {note || (source === "loading"
          ? "Using your saved preferences and active sensor warnings. Fixed safety actions are not changed by AI."
          : source === "safe_fallback" || source === "unavailable"
            ? "Showing standard safety guidance because AI personalization is unavailable."
            : "AI personalizes the wording; it does not diagnose or confirm that an environment is safe.")}
      </p>
    </section>
  );
}
