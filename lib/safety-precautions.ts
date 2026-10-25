 import type { SensorKey } from "@/lib/daily-sensor-summary";

export type SafetySeverity = "info" | "warning" | "urgent";

export type WarningSensitivity = "low" | "medium" | "high";

export type SafetyProfile = {
  screenTime?: string;
  outdoorTime?: string;
  environment?: string;
  warningSensitivity?: WarningSensitivity | string;
};

export type SafetyPrecaution = {
  sensor: SensorKey;
  title: string;
  message: string;
  action: string;
  severity: SafetySeverity;
  personalNote?: string;
};

type HistoricalContext = {
  anomalyDetected: boolean;
  baselineAvailable: boolean;
  baselineAverage: number | null;
  readingCount: number;
  unusualCount: number;
};

type PrecautionInput = {
  sensor: SensorKey;
  value: number | null;
  threshold: number;
  exceeded: boolean;
  profile?: SafetyProfile | null;
  history?: HistoricalContext | null;
};

export function getSafetyPrecaution(
  input: PrecautionInput
): SafetyPrecaution | null {
  const { sensor, value, threshold, exceeded, profile, history } = input;

  if (
    value === null ||
    !Number.isFinite(value) ||
    !Number.isFinite(threshold) ||
    !exceeded
  ) {
    return null;
  }

  let precaution: SafetyPrecaution;

  switch (sensor) {
    case "uv":
      precaution = {
        sensor,
        title: "UV Exposure Warning",
        message:
          "The UV sensor reading has exceeded your configured test threshold.",
        action:
          "Consider moving to shade or indoors and using appropriate sun protection. This sensor reading is not a calibrated UV index.",
        severity: "warning",
      };

      if (
        profile?.outdoorTime?.toLowerCase().includes("4 hours") ||
        profile?.outdoorTime?.toLowerCase().includes("more than")
      ) {
        precaution.personalNote =
          "Since your profile indicates substantial outdoor time, consider planning shade breaks during outdoor activities.";
      }
      break;

    case "gas":
      precaution = {
        sensor,
        title: "Air Quality Warning",
        message:
          "The gas sensor reading has exceeded your configured test threshold. The reading alone cannot identify a specific gas or its concentration.",
        action:
          "If you suspect an air-quality hazard, move away from the suspected source and get fresh air if safe. If you suspect a dangerous gas release, leave the area and contact local emergency services.",
        severity: "urgent",
      };

      if (
        profile?.environment?.toLowerCase().includes("indoor") ||
        profile?.environment?.toLowerCase().includes("mixed")
      ) {
        precaution.personalNote =
          "Because your profile includes indoor activity, pay attention to possible indoor sources. Do not investigate a suspected gas leak yourself.";
      }
      break;

    case "light":
      precaution = {
        sensor,
        title: "Bright Light Warning",
        message:
          "The light sensor reading has exceeded your configured test threshold. Brightness alone does not establish that light is harmful.",
        action:
          "Consider reducing exposure or moving away from the source. Never look directly at the Sun, lasers, or other potentially hazardous light sources.",
        severity: "warning",
      };

      if (
        profile?.screenTime?.toLowerCase().includes("6") ||
        profile?.screenTime?.toLowerCase().includes("8") ||
        profile?.screenTime?.toLowerCase().includes("more")
      ) {
        precaution.personalNote =
          "Your profile indicates substantial screen time. Consider regular breaks and comfortable screen brightness; this sensor cannot determine whether screen light is harmful.";
      }
      break;

    case "distance":
      precaution = {
        sensor,
        title: "Nearby Obstacle Warning",
        message:
          "The measured distance is below your configured proximity threshold.",
        action:
          "Slow down or stop if safe, check the path ahead, and avoid relying on the sensor alone to navigate.",
        severity: "warning",
      };
      break;

    default:
      return null;
  }

  // Add historical context only when a baseline is available.
  // Historical patterns never change the threshold or hazard severity.
  if (
    history?.baselineAvailable &&
    history.anomalyDetected
  ) {
    const historyNote =
      history.baselineAverage !== null
        ? `Today's sensor pattern differs from the historical baseline (average: ${history.baselineAverage}). Review the readings and their context; this pattern alone does not confirm a hazard.`
        : "Today's sensor pattern differs from the available historical baseline. Review the readings and their context; this pattern alone does not confirm a hazard.";

    precaution.personalNote = precaution.personalNote
      ? `${precaution.personalNote} ${historyNote}`
      : historyNote;
  }

  // Personalise advice without changing configured safety thresholds.
  if (
    profile?.warningSensitivity?.toLowerCase().includes("high") &&
    !precaution.personalNote
  ) {
    precaution.personalNote =
      "Your preference is for more sensitive warnings. This is a test-threshold alert, not confirmation of a real-world hazard.";
  }

  return precaution;
}