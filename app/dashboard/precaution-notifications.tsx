"use client";

import { useEffect, useRef, useState } from "react";
import type { SafetyPrecaution } from "@/lib/safety-precautions";

type Toast = SafetyPrecaution & { id: string };

const iconFor = (sensor: string) =>
  sensor === "uv" ? "☀️" :
  sensor === "gas" ? "🌬️" :
  sensor === "light" ? "💡" : "🚶";

export default function PrecautionNotifications({
  precautions,
}: {
  precautions: SafetyPrecaution[];
}) {
  const [toast, setToast] = useState<Toast | null>(null);
  const activeRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const precautionSignature = JSON.stringify(
    precautions.map(({ sensor, title, message, action, severity, personalNote }) => ({
      sensor, title, message, action, severity, personalNote,
    }))
  );

  useEffect(() => {
    const current = new Map(precautions.map((item) => [item.sensor, item]));
    const previous = activeRef.current;
    const newlyTriggered = precautions.find((item) => !previous.has(item.sensor));

    activeRef.current = new Set(current.keys());
    if (!newlyTriggered) return;

    const next: Toast = {
      ...newlyTriggered,
      id: `${newlyTriggered.sensor}-${Date.now()}`,
    };
    setToast(next);

    // Respect browser permission: never prompt the user unexpectedly.
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(next.title, {
          body: next.action,
          tag: `smart-spectacles-${next.sensor}`,
        });
      } catch {
        // In-app toast remains available if system notifications are blocked.
      }
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 9000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // Depend on content rather than a freshly allocated array from the dashboard.
  // This prevents unrelated renders from restarting the toast timer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precautionSignature]);

  if (!toast) return null;

  const urgent = toast.severity === "urgent";
  return (
    <aside
      role="alert"
      aria-live={urgent ? "assertive" : "polite"}
      aria-atomic="true"
      style={{
        position: "fixed",
        zIndex: 1200,
        right: 20,
        bottom: 20,
        width: "min(410px, calc(100vw - 32px))",
        padding: 18,
        borderRadius: 18,
        color: "#f8fafc",
        background: urgent
          ? "linear-gradient(135deg, #7f1d1d, #431407)"
          : "linear-gradient(135deg, #164e63, #172554)",
        border: `1px solid ${urgent ? "#fb7185" : "#67e8f9"}`,
        boxShadow: "0 18px 55px rgba(0,0,0,.38)",
        animation: "precaution-pop-in .25s ease-out",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1.2 }}>
          {urgent ? "🚨" : iconFor(toast.sensor)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, opacity: .85 }}>
            SMART SPECTACLES · SAFETY TIP
          </div>
          <h3 style={{ margin: "5px 0 7px", fontSize: 17 }}>{toast.title}</h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{toast.action}</p>
          <p style={{ margin: "9px 0 0", fontSize: 12, opacity: .82 }}>
            {urgent ? "Please act promptly." : "Stay aware. Your safety comes first."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Dismiss safety notification"
          style={{
            border: 0,
            borderRadius: 999,
            background: "rgba(255,255,255,.14)",
            color: "white",
            width: 30,
            height: 30,
            cursor: "pointer",
            fontSize: 19,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </aside>
  );
}
