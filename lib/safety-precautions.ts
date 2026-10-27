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

      precaution.personalNote =
        profile?.outdoorTime
          ? `Since you noted outdoor time in your profile (${profile.outdoorTime}), plan shade breaks and use a hat, covering clothing, and sunscreen as appropriate. The device reading is not a calibrated UV index.`
          : "Helpful next step: if you are outdoors, move into shade when practical, wear a brimmed hat and covering clothing, and use broad-spectrum sunscreen. This device reading is not a calibrated UV index.";
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

      precaution.personalNote =
        profile?.environment
          ? `Your profile lists your environment as ${profile.environment}. If you suspect poor air quality, move away from the source and get fresh air if safe; never investigate a suspected gas leak yourself.`
          : "Helpful next step: move away from any suspected source and get fresh air if safe. Do not approach or investigate a suspected gas leak; leave the area and contact local emergency services if a dangerous release is possible.";
      break;

    case "light":
      precaution = {
        sensor,
        title: "Low Light Warning",
        message:
          "The light sensor reading is below your configured low-light threshold.",
        action:
          "Move to a better-lit area if safe, increase room lighting where possible, and pause tasks if you cannot see clearly. Do not rely on this sensor alone to judge visibility.",
        severity: "warning",
      };

      precaution.personalNote =
        profile?.screenTime
          ? `Since your profile notes ${profile.screenTime} of screen time, take regular comfort breaks and adjust lighting so you can see clearly. This sensor cannot determine whether light is harmful.`
          : "Helpful next step: move to a well-lit area if safe, reduce glare, and take a short comfort break if your eyes feel strained. This sensor cannot determine whether light is harmful.";
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
        personalNote:
          "Helpful next step: pause, look around carefully, and ask for assistance if visibility is poor. The distance sensor is experimental and cannot replace normal care or mobility aids.",
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

  // These tips are generated from simple rules and profile/history context, not an LLM.
  // They never change configured safety thresholds or independently establish a hazard.
  if (
    profile?.warningSensitivity?.toLowerCase().includes("high") &&
    precaution.personalNote
  ) {
    precaution.personalNote +=
      " Your settings prefer more sensitive warnings; this test-threshold alert does not by itself confirm a real-world hazard.";
  }

  return precaution;
}